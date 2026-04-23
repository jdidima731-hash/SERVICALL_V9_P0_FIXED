import { z } from "zod";
import { router, tenantProcedure } from "../procedures";
import { CallScoringService } from "../services/callScoringService";
import { addJob } from "../services/queueService";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Router pour le scoring des appels
 * ✅ AXE 3: Scoring 100% asynchrone via BullMQ
 * ✅ BLOC 1: Toutes les procédures utilisent tenantProcedure — ctx.tenantId! garanti non-null
 */

export const callScoringRouter = router({
  /**
   * Score un appel spécifique (Asynchrone)
   */
  scoreCall: tenantProcedure
    .input(
      z.object({
        callId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      const { callId } = input;

      // 1. Vérifier que l'appel existe et appartient au tenant
      const db = (await import("../db")).getDbInstance();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { calls } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const callResults = await db
        .select()
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (callResults.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      const call = callResults[0] ?? undefined;
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found after initial check",
        });
      }

      // ✅ BLOC 1: Vérification d'isolation tenant — ctx.tenantId! garanti par tenantProcedure
      if (call.tenantId !== ctx.tenantId!) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this call",
        });
      }

      // 2. ✅ AXE 3: Ajouter le job de scoring à la queue BullMQ au lieu de l'exécuter en synchrone
      try {
        await addJob("call-analysis", {
          callId,
          tenantId: ctx.tenantId!,
          timestamp: new Date()
        });
        
        logger.info("[CallScoringRouter] Scoring job queued", { callId, tenantId: ctx.tenantId! });
      } catch (error: any) {
        logger.error("[CallScoringRouter] Failed to queue scoring job", { error, callId });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre l'analyse en file d'attente",
        });
      }

      return {
        success: true,
        message: "L'analyse de l'appel a été mise en file d'attente.",
        status: "queued"
      };
    }),

  /**
   * Récupère le score d'un appel
   */
  getScore: tenantProcedure
    .input(
      z.object({
        callId: z.number().int().positive(),
      })
    )
    .query(async ({ input }: any) => {
      const { callId } = input;

      const score = await CallScoringService.getScore(callId);

      if (!score) {
        return { status: "pending", message: "Le score est en cours de calcul ou indisponible." };
      }

      return { status: "completed", ...score };
    }),

  /**
   * Liste tous les scores pour le tenant courant
   * ✅ BLOC 1: tenantProcedure garantit ctx.tenantId! non-null — vérification manuelle supprimée
   */
  listScores: tenantProcedure
    .input(
      z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }: any) => {
      const { limit, offset } = input;
      const scores = await CallScoringService.listScores(ctx.tenantId!, limit, offset);
      return { scores, total: scores.length };
    }),

  /**
   * Récupère le score moyen pour le tenant
   * ✅ BLOC 1: tenantProcedure garantit ctx.tenantId! non-null — vérification manuelle supprimée
   */
  getAverageScore: tenantProcedure.query(async ({ ctx }) => {
    const averageScore = await CallScoringService.getAverageScore(ctx.tenantId!);
    return { averageScore, tenantId: ctx.tenantId! };
  }),
});
