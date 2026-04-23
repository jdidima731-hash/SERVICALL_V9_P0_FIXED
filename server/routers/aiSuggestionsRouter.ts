/**
 * BLOC 3 - AI Suggestions Router
 * Expose les fonctionnalités du Shadow Agent au frontend
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { ShadowAgentService } from "../services/shadowAgentService";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";

export const aiSuggestionsRouter = router({
  /**
   * Récupérer les suggestions en attente
   */
  getPending: tenantProcedure
    .input(z.object({
    }))
    .query(async ({ ctx }) => {
      try {
        const tenantId = ctx.tenantId!;
        return await ShadowAgentService.getPendingSuggestions(tenantId);
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: (error instanceof Error ? error.message : String(error)) || "Erreur lors de la récupération des suggestions",
        });
      }
    }),

  /**
   * Déclencher la détection d'appels manqués
   */
  detectMissedCalls: tenantProcedure
    .input(z.object({
    }))
    .mutation(async ({ ctx }) => {
      try {
        const tenantId = ctx.tenantId!;
        return await ShadowAgentService.detectMissedCallsAndSuggest(tenantId);
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: (error instanceof Error ? error.message : String(error)) || "Erreur lors de la détection",
        });
      }
    }),

  /**
   * Approuver une suggestion
   */
  approve: tenantProcedure
    .input(z.object({
      suggestionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        return await ShadowAgentService.approveSuggestion(
          input.suggestionId,
          tenantId,
          ctx.userId
        );
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: (error instanceof Error ? error.message : String(error)) || "Erreur lors de l'approbation",
        });
      }
    }),

  /**
   * Rejeter une suggestion
   */
  reject: tenantProcedure
    .input(z.object({
      suggestionId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        return await ShadowAgentService.rejectSuggestion(
          input.suggestionId,
          tenantId,
          ctx.userId
        );
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: (error instanceof Error ? error.message : String(error)) || "Erreur lors du rejet",
        });
      }
    }),

  /**
   * Modifier une suggestion
   */
  modify: tenantProcedure
    .input(z.object({
      suggestionId: z.number(),
      newContent: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const tenantId = ctx.tenantId!;
        return await ShadowAgentService.modifySuggestion(
          input.suggestionId,
          tenantId,
          input.newContent
        );
      } catch (error: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: (error instanceof Error ? error.message : String(error)) || "Erreur lors de la modification",
        });
      }
    }),
});
