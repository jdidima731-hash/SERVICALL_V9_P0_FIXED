/**
 * =====================================================================
 * TRPC.TS — SERVICALL V8
 * BLOC 4 — GESTION DES ERREURS & LOGS
 * =====================================================================
 */

import { UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext, ProtectedTrpcContext, TenantTrpcContext } from "./context";
import { logger } from "../infrastructure/logger";
import { setTag, setContext, captureException } from "@sentry/node";
import { createErrorMiddleware } from "../config/appErrors";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

// ─── Error Middleware ─────────────────────────────────────────────────────────
const errorMiddleware = createErrorMiddleware(t);

// ─── Rate Limiting Middleware ─────────────────────────────────────────────────

const rateLimitMiddleware = t.middleware(async ({ ctx, next, path }) => {
  if (process.env["NODE_ENV"] === "test") return next();

  try {
    const { getRedisClient } = await import("../infrastructure/redis/redis.client");
    const redis = getRedisClient();

    if (!redis || typeof redis.call !== "function") return next();

    const ip = ctx.req.ip || "unknown";
    const key = `rl:trpc:${path}:${ip}`;

    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, 60);

    const limit = 200;
    if (current > limit) {
      logger.warn(`[TRPC RateLimit] Limit exceeded for ${path} from ${ip}`);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Trop de requêtes. Veuillez ralentir.",
      });
    }
  } catch (error: unknown) {
    if (error instanceof TRPCError) throw error;
    logger.error("[TRPC RateLimit] Error checking rate limit", error);
  }

  return next();
});

// ─── Sentry Middleware ────────────────────────────────────────────────────────

const sentryMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  try {
    const result = await next();
    if (!result.ok) {
      setTag("trpc.path", path);
      setTag("trpc.type", type);
      setContext("trpc.context", { userId: ctx.user?.id, tenantId: ctx.tenantId ?? null });
      captureException(result.error);
    }
    return result;
  } catch (error: unknown) {
    setTag("trpc.path", path);
    setTag("trpc.type", type);
    captureException(error);
    throw error;
  }
});

// ─── Middlewares de Sécurité ──────────────────────────────────────────────────

/**
 * requireUser : Garantit que l'utilisateur est authentifié.
 */
const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.isAuthenticated || !ctx.user || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      user: ctx.user,
      userId: ctx.userId,
    } satisfies Partial<ProtectedTrpcContext>,
  });
});

/**
 * requireTenantContext : Garantit un contexte tenant valide.
 */
const requireTenantContext = t.middleware(async ({ ctx, next, path }) => {
  if (!ctx.isAuthenticated || !ctx.user || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.hasTenant && !ctx.isSuperAdmin) {
    logger.warn("[TRPC] Auth sans tenant — accès tenant refusé", {
      userId: ctx.user.id,
      tenantId: ctx.tenantId,
      path,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Votre compte n'est associé à aucune organisation.",
    });
  }

  if (ctx.isSuperAdmin) {
    return next({
      ctx: {
        tenantId: -1,
        isSuperAdmin: true,
      } satisfies Partial<TenantTrpcContext>,
    });
  }

  if (ctx.user.tenantId !== ctx.tenantId) {
    logger.warn("[TRPC] Cross-tenant access attempt BLOCKED", {
      userId: ctx.user.id,
      userTenantId: ctx.user.tenantId,
      requestedTenantId: ctx.tenantId,
      path,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès refusé : ce compte n'appartient pas à cette organisation.",
    });
  }

  const normalizeRole = (role: string): 'admin' | 'manager' | 'agent' => {
    if (role === 'admin' || role === 'owner' || role === 'superadmin') return 'admin';
    if (role === 'manager') return 'manager';
    return 'agent';
  };

  const tenantContext = {
    tenantId: ctx.tenantId as number,
    role: normalizeRole(ctx.user.role),
    userId: ctx.user.id,
    issuedAt: Date.now(),
  };

  return next({
    ctx: {
      tenantId: ctx.tenantId as number,
      tenantContext,
    } satisfies Partial<TenantTrpcContext>,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure
  .use(errorMiddleware)
  .use(sentryMiddleware)
  .use(rateLimitMiddleware);

export const protectedProcedure = publicProcedure.use(requireUser);
export const baseTenantProcedure = protectedProcedure.use(requireTenantContext);
export const tenantProcedure = baseTenantProcedure;

export function requireTenant(ctx: TrpcContext | ProtectedTrpcContext | TenantTrpcContext) {
  if (ctx.tenantId === null || ctx.tenantId === undefined) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Tenant missing",
    });
  }
  return ctx.tenantId;
}
