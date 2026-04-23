import { 
  protectedProcedure, 
  publicProcedure, 
  router, 
  tenantProcedure as baseTenantProcedure,
  middleware
} from "./_core/trpc";

export { protectedProcedure, publicProcedure, router };
import { TRPCError } from "@trpc/server";
import { RBACService, Role, Permission } from "./services/rbacService";
import { logger } from "./infrastructure/logger";
import { withRequestContext } from "./services/requestDbContext";
import type { TenantDbContext, TenantDbTrpcContext, TenantTrpcContext } from "./_core/context";

/**
 * Middleware de timeout pour tRPC
 * ✅ Bloc 3: Typage strict et gestion des timers
 */
export const timeoutMiddleware = (timeoutMs: number = 30000) => 
  middleware(async ({ ctx, next, path }) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        logger.warn("[tRPC] Request timeout", {
          timeoutMs,
          userId: ctx.user?.id,
          tenantId: ctx.tenantId,
          path
        });
        reject(new TRPCError({
          code: "TIMEOUT",
          message: `Request exceeded timeout of ${timeoutMs}ms`
        }));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([next(), timeoutPromise]);
      if (timeoutId !== null) clearTimeout(timeoutId);
      return result;
    } catch (error: unknown) {
      if (timeoutId !== null) clearTimeout(timeoutId);
      throw error;
    }
  });

// Middleware de timeout par défaut (30s)
const defaultTimeoutMiddleware = timeoutMiddleware(30000);

/**
 * ✅ DURCISSEMENT SaaS: Procedure avec TenantId obligatoire et RLS
 */
export const tenantProcedure = baseTenantProcedure
  .use(defaultTimeoutMiddleware)
  .use(async ({ ctx, next }) => {
    // requireTenantContext a déjà validé tenantId et tenantContext
    const tenantId = ctx.tenantId!;
    const userId = ctx.userId;

    if (!userId || userId <= 0) {
      logger.error("[RLS] Missing userId in tenant procedure -- fail-closed", { tenantId });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Contexte utilisateur manquant. Accès refusé.",
      });
    }

    try {
      return await withRequestContext({ userId, tenantId }, async (tx) => {
        const tenantDb = tx as TenantDbContext;
        return await next({
          ctx: {
            db: tenantDb,
            tenantRole: ctx.tenantContext?.role as Role,
          } as Partial<TenantDbTrpcContext & { tenantRole: Role }>,
        });
      });
    } catch (error: unknown) {
      if (error instanceof TRPCError) throw error;
      logger.error("[RLS] withRequestContext failed -- fail-closed", { error, tenantId, userId });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible d'établir le contexte de sécurité tenant.",
      });
    }
  });

/**
 * Factory for procedures requiring specific permissions
 */
export const permissionProcedure = (permission: Permission) => 
  tenantProcedure.use(({ ctx, next }) => {
    RBACService.validatePermission(ctx.tenantRole as Role, permission);
    return next();
  });

/**
 * Procedure that requires admin or manager role in the tenant
 */
export const managerProcedure = tenantProcedure.use(({ ctx, next }) => {
  RBACService.validateRole(ctx.tenantRole as Role, "manager");
  return next();
});

/**
 * Procedure that requires admin role in the tenant
 */
export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  RBACService.validateRole(ctx.tenantRole as Role, "admin");
  return next();
});

/**
 * Procedure that requires superadmin role
 */
export const superAdminProcedure = protectedProcedure
  .use(defaultTimeoutMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.isSuperAdmin) {
      logger.warn("[TRPC] superAdminProcedure — accès refusé", {
        userId: ctx.user?.id,
        tenantId: ctx.tenantId,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Action réservée aux super-administrateurs globaux",
      });
    }
    return next();
  });

/**
 * Procedure that requires EXACTLY the agent role in the tenant
 */
export const agentProcedure = tenantProcedure.use(({ ctx, next }) => {
  const role = ctx.tenantRole as Role;
  if (role !== "agent" && role !== "admin" && role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cette action est réservée aux agents autorisés.",
    });
  }
  return next();
});
