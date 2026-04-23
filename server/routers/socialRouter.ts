/**
 * Social Media Manager Router - tRPC
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 * ✅ Logic moved to SocialService
 */
import { router } from "../_core/trpc";
import { z } from "zod";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { paginationInput, paginate } from "../_core/pagination";
import { SocialService } from "../services/socialService";
import { normalizeDbRecords, normalizeDbRecord } from "../_core/responseNormalizer";

// Plateformes supportées
const PLATFORMS = ["facebook", "instagram", "linkedin", "twitter", "tiktok"] as const;

export const socialRouter = router({
  /**
   * Statut des connexions réseaux sociaux
   */
  getConnections: tenantProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
    return await SocialService.getConnectionsStatus(ctx.tenantId);
  }),

  /**
   * Connecter un compte réseau social
   */
  connectAccount: tenantProcedure
    .input(z.object({
      platform: z.enum(PLATFORMS),
      accessToken: z.string(),
      accountName: z.string().optional(),
      platformAccountId: z.string().optional(),
      metadata: z.record(z.unknown()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      return await SocialService.connectAccount(ctx.tenantId, input);
    }),

  /**
   * Déconnecter un compte réseau social
   */
  disconnectAccount: tenantProcedure
    .input(z.object({ platform: z.enum(PLATFORMS) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      return await SocialService.disconnectAccount(ctx.tenantId, input.platform);
    }),

  /**
   * Lister les posts planifiés ou publiés
   */
  listPosts: tenantProcedure
    .input(paginationInput.extend({
      status: z.enum(["draft", "scheduled", "published", "failed"]).optional(),
      platform: z.enum(PLATFORMS).optional(),
    }))
    .query(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      const { data, total } = await SocialService.listPosts(ctx.tenantId, input);
      return paginate(normalizeDbRecords(data), total, input);
    }),

  /**
   * Générer des posts via IA
   */
  generatePosts: tenantProcedure
    .input(z.object({
      prompt: z.string(),
      count: z.number().min(1).max(6).default(3),
      platforms: z.array(z.enum(PLATFORMS)),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "BAD_REQUEST" });
      const posts = await SocialService.generatePosts(ctx.tenantId, input);
      return normalizeDbRecords(posts);
    }),
});

// TS2305 FIX — stub decryptToken
export function decryptToken(encryptedToken: string): string {
  const { decryptData } = require("../services/securityService");
  return decryptData(encryptedToken);
}
