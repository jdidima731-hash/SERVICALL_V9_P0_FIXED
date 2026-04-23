/**
 * REALTIME WORKFLOW ROUTER
 * API pour le monitoring des workflows temps réel
 * ✅ BLOC 2 : Suivi des appels en cours
 * ✅ BLOC 2 : État des actions vocales
 * ✅ BLOC 2 : Logs et statistiques
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import { RealtimeWorkflowMonitor } from "../services/realtimeWorkflowMonitor";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";

export const realtimeWorkflowRouter = router({
  /**
   * Liste les appels actifs pour le tenant (utilise getRecentCallsFromDB comme fallback)
   */
  getActiveCalls: tenantProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      // Utilise getRecentCallsFromDB avec un filtre sur les appels actifs
      const recentCalls = await RealtimeWorkflowMonitor.getRecentCallsFromDB(ctx.tenantId!, 50);
      const activeCalls = recentCalls.filter((c) =>
        c.status === "in_progress" || c.status === "scheduled"
      );

      logger.info("[RealtimeWorkflow] Active calls retrieved", {
        tenantId: ctx.tenantId!,
        count: activeCalls.length,
      });

      return activeCalls;
    } catch (error: any) {
      logger.error("[RealtimeWorkflow] Error getting active calls", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId!,
      });
      return [];
    }
  }),

  /**
   * Récupère l'historique des appels récents
   */
  getCallHistory: tenantProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        const history = await RealtimeWorkflowMonitor.getRecentCallsFromDB(
          ctx.tenantId!,
          input.limit
        );

        logger.info("[RealtimeWorkflow] Call history retrieved", {
          tenantId: ctx.tenantId!,
          count: history.length,
        });

        return history;
      } catch (error: any) {
        logger.error("[RealtimeWorkflow] Error getting call history", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId!,
        });
        return [];
      }
    }),

  /**
   * Récupère le statut d'un appel spécifique
   */
  getCallStatus: tenantProcedure
    .input(
      z.object({
        callSid: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        const status = await RealtimeWorkflowMonitor.getCallStatus(input.callSid);

        if (!status) {
          logger.warn("[RealtimeWorkflow] Call status not found", {
            callSid: input.callSid,
            tenantId: ctx.tenantId!,
          });
          return null;
        }

        // Vérifier que l'appel appartient au tenant
        if (status.tenantId !== ctx.tenantId!) {
          logger.warn("[RealtimeWorkflow] Unauthorized access to call status", {
            callSid: input.callSid,
            tenantId: ctx.tenantId!,
            callTenantId: status.tenantId,
          });
          return null;
        }

        return status;
      } catch (error: any) {
        logger.error("[RealtimeWorkflow] Error getting call status", {
          error: error instanceof Error ? error.message : String(error),
          callSid: input.callSid,
          tenantId: ctx.tenantId!,
        });
        return null;
      }
    }),

  /**
   * Récupère les statistiques globales
   */
  getStats: tenantProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      // Calculer les stats depuis les appels récents
      const recentCalls = await RealtimeWorkflowMonitor.getRecentCallsFromDB(ctx.tenantId!, 100);
      const activeCalls = recentCalls.filter((c) =>
        c.status === "in_progress" || c.status === "scheduled"
      ).length;
      const failedCalls = recentCalls.filter((c) => c.status === "failed").length;

      const stats = {
        activeCalls,
        totalActionsCompleted: recentCalls.filter((c) => c.status === "completed").length,
        totalActionsFailed: failedCalls,
        callsWithErrors: failedCalls,
      };

      logger.info("[RealtimeWorkflow] Stats retrieved", {
        tenantId: ctx.tenantId!,
        stats,
      });

      return stats;
    } catch (error: any) {
      logger.error("[RealtimeWorkflow] Error getting stats", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId!,
      });
      return {
        activeCalls: 0,
        totalActionsCompleted: 0,
        totalActionsFailed: 0,
        callsWithErrors: 0,
      };
    }
  }),

  /**
   * Récupère les appels récents depuis la base de données
   */
  getRecentCallsFromDB: tenantProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        const calls = await RealtimeWorkflowMonitor.getRecentCallsFromDB(
          ctx.tenantId!,
          input.limit
        );

        logger.info("[RealtimeWorkflow] Recent calls from DB retrieved", {
          tenantId: ctx.tenantId!,
          count: calls.length,
        });

        return calls;
      } catch (error: any) {
        logger.error("[RealtimeWorkflow] Error getting recent calls from DB", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId!,
        });
        return [];
      }
    }),
});
