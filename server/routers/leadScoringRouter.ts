/**
 * Lead Scoring Router
 * tRPC endpoints pour le scoring IA des leads
 * ✅ PHASE 3 — Dashboard Analytics Pro
 */

import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { aiLeadScoringService } from "../services/aiLeadScoringService";
import { logger } from "../infrastructure/logger";

export const leadScoringRouter = router({
  /**
   * Calcule le score d'un lead spécifique
   */
  calculateScore: tenantProcedure
    .input(z.object({ prospectId: z.number() }))
    .query(async ({ input, ctx }: any) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID required" });
        }

        const score = await aiLeadScoringService.calculateLeadScore(
          input.prospectId,
          ctx.tenantId!
        );

        return score;
      } catch (error: any) {
        logger.error("[LeadScoringRouter] Error calculating score", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate lead score",
        });
      }
    }),

  /**
   * Recalcule les scores de tous les leads
   */
  recalculateAll: tenantProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID required" });
      }

      const scores = await aiLeadScoringService.recalculateAllLeadScores(ctx.tenantId!);

      return {
        success: true,
        count: scores.length,
        scores,
      };
    } catch (error: any) {
      logger.error("[LeadScoringRouter] Error recalculating all scores", { error });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to recalculate lead scores",
      });
    }
  }),

  /**
   * Récupère les leads par badge
   */
  getByBadge: tenantProcedure
    .input(z.object({ badge: z.enum(["Froid", "Tiède", "Chaud"]) }))
    .query(async ({ input, ctx }: any) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID required" });
        }

        const leads = await aiLeadScoringService.getLeadsByBadge(ctx.tenantId!, input.badge);

        return {
          badge: input.badge,
          count: leads.length,
          leads: leads.map((l) => ({
            prospect: l.prospect,
            score: l.score.score,
            reasoning: l.score.reasoning,
          })),
        };
      } catch (error: any) {
        logger.error("[LeadScoringRouter] Error getting leads by badge", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get leads by badge",
        });
      }
    }),

  /**
   * Récupère les statistiques de scoring
   */
  getStats: tenantProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tenant ID required" });
      }

      // Récupérer les leads par badge
      const chauds = await aiLeadScoringService.getLeadsByBadge(ctx.tenantId!, "Chaud");
      const tiedes = await aiLeadScoringService.getLeadsByBadge(ctx.tenantId!, "Tiède");
      const froids = await aiLeadScoringService.getLeadsByBadge(ctx.tenantId!, "Froid");

      const total = chauds.length + tiedes.length + froids.length;

      return {
        total,
        chauds: chauds.length,
        tiedes: tiedes.length,
        froids: froids.length,
        percentages: {
          chauds: total > 0 ? Math.round((chauds.length / total) * 100) : 0,
          tiedes: total > 0 ? Math.round((tiedes.length / total) * 100) : 0,
          froids: total > 0 ? Math.round((froids.length / total) * 100) : 0,
        },
      };
    } catch (error: any) {
      logger.error("[LeadScoringRouter] Error getting stats", { error });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get lead scoring stats",
      });
    }
  }),
});
