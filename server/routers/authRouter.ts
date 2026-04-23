import type { Request, Response } from "express";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../procedures";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { AuthService } from "../services/authService";
import { logger } from "../infrastructure/logger";
import { UserPublicDTOSchema } from "../../shared/dto/user.dto";
import { DTOMapperService } from "../services/dtoMapperService";

/**
 * Auth Router — Thin Router
 * ✅ BLOC 3 FIX: Typage strict et schémas de sortie
 * ✅ FIX V8 : suppression des contournements TypeScript
 */

const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const authUserResponseSchema = z.object({
  user: UserPublicDTOSchema,
});

const currentTenantResponseSchema = z
  .object({
    tenantId: z.number().int().positive(),
    role: z.string().nullable(),
  })
  .nullable();

const myTenantSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  role: z.string().min(1),
});

const logoutResponseSchema = z.object({ success: z.boolean() });

async function issueSessionCookie(
  ctx: { req?: Request; res?: Response },
  user: { openId: string; name: string | null },
): Promise<void> {
  if (!ctx.req || !ctx.res) {
    return;
  }

  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name ?? "",
    expiresInMs: SESSION_DURATION_MS,
  });

  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: SESSION_DURATION_MS,
  });
}

export const authRouter = router({
  /**
   * Récupère l'utilisateur actuel
   */
  me: publicProcedure.output(UserPublicDTOSchema.nullable()).query(async ({ ctx }) => {
    if (!ctx.user) {
      return null;
    }

    return DTOMapperService.mapUserPublic(ctx.user);
  }),

  /**
   * Récupère le tenant actuel de l'utilisateur basé sur la session
   */
  currentTenant: publicProcedure.output(currentTenantResponseSchema).query(async ({ ctx }) => {
    if (!ctx.user || !ctx.tenantId || ctx.tenantId <= 0) {
      return null;
    }

    return {
      tenantId: ctx.tenantId,
      role: ctx.tenantRole ?? null,
    };
  }),

  /**
   * Connexion utilisateur
   */
  login: publicProcedure
    .input(loginInputSchema)
    .output(authUserResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const user = await AuthService.login(input.email, input.password);
        await issueSessionCookie(ctx, user);

        return {
          user: DTOMapperService.mapUserPublic(user),
        };
      } catch (error: unknown) {
        logger.error("[AuthRouter] Login error", {
          error: error instanceof Error ? error.message : String(error),
          email: input.email,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la connexion",
        });
      }
    }),

  /**
   * Déconnexion utilisateur
   */
  logout: publicProcedure.output(logoutResponseSchema).mutation(async ({ ctx }) => {
    if (ctx.res && ctx.req) {
      const sessionCookie = ctx.req.cookies?.[COOKIE_NAME] ?? ctx.req.signedCookies?.[COOKIE_NAME];
      if (sessionCookie) {
        await sdk.revokeToken(sessionCookie);
      }

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
    }

    return { success: true };
  }),

  /**
   * Inscription utilisateur
   */
  register: publicProcedure
    .input(registerInputSchema)
    .output(authUserResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const user = await AuthService.register(input);
        await issueSessionCookie(ctx, user);

        return {
          user: DTOMapperService.mapUserPublic(user),
        };
      } catch (error: unknown) {
        logger.error("[AuthRouter] Register error", {
          error: error instanceof Error ? error.message : String(error),
          email: input.email,
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'inscription",
        });
      }
    }),

  /**
   * Liste les tenants de l'utilisateur
   */
  myTenants: publicProcedure.output(z.array(myTenantSchema)).query(async ({ ctx }) => {
    if (!ctx.user) {
      return [];
    }

    const tenants = await AuthService.getUserTenants(ctx.user.id);
    return tenants.map((tenant) =>
      myTenantSchema.parse({
        id: tenant.id,
        name: tenant.name,
        role: tenant.role,
      }),
    );
  }),
});
