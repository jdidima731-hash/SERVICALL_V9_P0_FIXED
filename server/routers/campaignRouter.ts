/**
 * FIXES SÉCURITÉ APPLIQUÉS:
 *
 * CRIT-4: addProspects — ctx ignoré, IDOR
 *   Avant: .mutation(async ({ input }: any) => { ... }) // ctx absent
 *          N'importe quel manager peut modifier des campagnes d'autres tenants.
 *   Après: ctx destructuré + vérification d'appartenance avant toute action.
 *
 * CRIT-5: updateStatus — ctx ignoré, IDOR
 *   Avant: .mutation(async ({ input }: any) => { ... }) // ctx absent
 *   Après: ctx destructuré + vérification d'appartenance avant toute action.
 *
 * Bonus: getProspects corrigé aussi (même IDOR potentiel, ctx absent).
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { CampaignService } from "../services/campaignService";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, managerProcedure } from "../procedures";
import { normalizeResponse, normalizeDbRecords } from "../_core/responseNormalizer";
import { dialerEngine } from "../services/dialer/dialer-engine";
import { paginationInput, paginate } from "../_core/pagination";
import * as db from "../db";
import { count, eq } from "drizzle-orm";

// ─── Helper: assertion d'appartenance d'une campagne au tenant ────────────────
// Utilisé dans addProspects, updateStatus, getProspects, startDialer, etc.

async function assertCampaignOwnership(campaignId: number, tenantId: number): Promise<void> {
  const campaign = await CampaignService.getCampaignById(campaignId);

  if (!campaign) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Campagne introuvable" });
  }

  // FIX CRIT-4/5: vérifier l'appartenance au tenant avant toute action
  if (campaign.tenantId !== tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès refusé: cette campagne n'appartient pas à votre organisation.",
    });
  }
}

export const campaignRouter = router({
  /**
   * List all campaigns for a tenant with pagination
   */
  list: tenantProcedure
    .input(paginationInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      const [campaigns, totalResult] = await Promise.all([
        CampaignService.getCampaigns(ctx.tenantId!, { limit, offset }),
        db.db.select({ value: count() })
          .from(db.campaigns)
          .where(eq(db.campaigns.tenantId, ctx.tenantId!)),
      ]);

      const normalizedData = normalizeDbRecords(campaigns);
      return paginate(normalizedData, totalResult[0]?.value ?? 0, input);
    }),

  /**
   * Create a new campaign
   */
  create: managerProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      activityType: z.string().optional(),
      type: z.enum(["ai_qualification", "human_appointment", "hybrid_reception"]).default("ai_qualification"),
      config: z.unknown().optional(),
      targetAudience: z.string().optional(),
      prospectCount: z.number().optional(),
      aiEnabled: z.boolean().optional(),
      aiRoleId: z.number().optional(),
      conversionGoal: z.number().optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        const campaignData = {
          name: input.name,
          description: input.description,
          type: input.type,
          activityType: input.activityType ?? "prospection",
          tenantId: ctx.tenantId!,
          status: input.status || "active",
          details: {
            ...(input.config as object || {}),
            targetAudience: input.targetAudience,
            prospectCount: input.prospectCount,
            aiEnabled: input.aiEnabled,
            aiRoleId: input.aiRoleId,
            conversionGoal: input.conversionGoal,
          },
        };

        const campaign = await CampaignService.createCampaign(campaignData);
        return normalizeResponse(campaign, 'campaign.create');
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create campaign" });
      }
    }),

  /**
   * FIX CRIT-4: Ajouter des prospects — ctx obligatoire + vérification propriété
   * Avant: .mutation(async ({ input }: any) => { ... })  // IDOR: ctx absent
   * Après: .mutation(async ({ ctx, input }) => { ... }) + assertCampaignOwnership
   */
  addProspects: managerProcedure
    .input(z.object({
      campaignId: z.number(),
      prospectIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      // CRIT-4 FIX: ctx est maintenant destructuré + vérification tenant
      await assertCampaignOwnership(input.campaignId, ctx.tenantId!);

      const added = await CampaignService.addProspects(input.campaignId, input.prospectIds);
      return { success: true, added: added.length, message: `${added.length} prospect(s) ajouté(s)` };
    }),

  /**
   * FIX CRIT-5: Changer le statut — ctx obligatoire + vérification propriété
   * Avant: .mutation(async ({ input }: any) => { ... })  // IDOR: ctx absent
   * Après: .mutation(async ({ ctx, input }) => { ... }) + assertCampaignOwnership
   */
  updateStatus: managerProcedure
    .input(z.object({
      campaignId: z.number(),
      status: z.enum(["draft", "ready", "active", "paused", "completed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      // CRIT-5 FIX: ctx est maintenant destructuré + vérification tenant
      await assertCampaignOwnership(input.campaignId, ctx.tenantId!);

      await CampaignService.updateStatus(input.campaignId, input.status);
      return { success: true };
    }),

  /**
   * Récupérer les prospects d'une campagne (IDOR bonus fix)
   * Avant: .query(async ({ input }: any) => { ... })  // ctx absent
   */
  getProspects: tenantProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      // Bonus fix: vérification d'appartenance
      await assertCampaignOwnership(input.campaignId, ctx.tenantId!);

      const prospects = await CampaignService.getCampaignProspects(input.campaignId);
      return { success: true, data: prospects };
    }),

  // ─── Predictive Dialer ──────────────────────────────────────────────────────

  startDialer: managerProcedure
    .input(z.object({
      campaignId: z.number(),
      pacingRatio: z.number().min(0.5).max(5).default(1),
      maxAttempts: z.number().min(1).max(5).default(3),
      retryDelayMs: z.number().min(60_000).max(3_600_000).default(300_000),
    }))
    .mutation(async ({ input, ctx }: any) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      await assertCampaignOwnership(input.campaignId, ctx.tenantId!);
      const result = await dialerEngine.startCampaign(
        input.campaignId,
        ctx.tenantId!,
        { pacingRatio: input.pacingRatio, maxAttempts: input.maxAttempts, retryDelayMs: input.retryDelayMs }
      );
      return { success: true, ...result };
    }),

  stopDialer: managerProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ input, ctx }: any) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      await assertCampaignOwnership(input.campaignId, ctx.tenantId!);
      await dialerEngine.stopCampaign(input.campaignId, ctx.tenantId!);
      return { success: true };
    }),

  dialerStatus: tenantProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input, ctx }: any) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      await assertCampaignOwnership(input.campaignId, ctx.tenantId!);
      const status = await dialerEngine.getCampaignStatus(input.campaignId, ctx.tenantId!);
      return { success: true, data: status };
    }),
});
