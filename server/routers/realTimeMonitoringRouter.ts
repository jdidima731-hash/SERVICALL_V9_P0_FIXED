/**
 * REAL-TIME MONITORING ROUTER
 * Permet de visualiser l'état des appels et des workflows en cours.
 * ✅ Isolation tenant stricte.
 */

import { z } from "zod";
import { tenantProcedure } from "../procedures";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db, calls } from "../db";
import { eq, and, desc, gte } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export const realTimeMonitoringRouter = router({
  /**
   * Récupère les appels actifs pour le tenant
   */
  getActiveCalls: tenantProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      const activeCalls = await db.select()
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, ctx.tenantId!),
            eq(calls.status, "in_progress")
          )
        )
        .orderBy(desc(calls.createdAt))
        .limit(20);

      return activeCalls;
    } catch (error: any) {
      logger.error("[MonitoringRouter] Failed to get active calls", { tenantId: ctx.tenantId!, error });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de récupérer les appels actifs" });
    }
  }),

  /**
   * Récupère les derniers logs de workflow pour le tenant
   */
  getRecentWorkflowLogs: tenantProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant ID is required",
          });
        }
        // Dans une vraie app, on interrogerait une table de logs ou Elasticsearch
        // Ici, on simule à partir des appels récents
        const recentCalls = await db.select()
          .from(calls)
          .where(
            and(
              eq(calls.tenantId, ctx.tenantId!),
              gte(calls.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Dernières 24h
            )
          )
          .orderBy(desc(calls.createdAt))
          .limit(input.limit);

        return recentCalls.map((call: Record<string, unknown>) => ({
          id: call['id'],
          timestamp: call['createdAt'],
          status: call['status'],
          direction: call['callType'],
          from: call['fromNumber'],
          to: call['toNumber'],
          message: `Appel ${call['callType']} ${call['status']}`,
          hasError: call['status'] === "failed"
        }));
      } catch (error: any) {
        logger.error("[MonitoringRouter] Failed to get workflow logs", { tenantId: ctx.tenantId!, error });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de récupérer les logs" });
      }
    }),

  /**
   * Statistiques de performance temps réel
   */
  getRealTimeStats: tenantProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant ID is required",
        });
      }
      const [totalToday, active] = await Promise.all([
        db.select()
          .from(calls)
          .where(
            and(
              eq(calls.tenantId, ctx.tenantId!),
              gte(calls.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))
            )
          ),
        db.select()
          .from(calls)
          .where(
            and(
              eq(calls.tenantId, ctx.tenantId!),
              eq(calls.status, "in_progress")
            )
          )
      ]);

      return {
        totalCallsToday: totalToday.length,
        activeCalls: active.length,
        successRate: totalToday.length > 0 
          ? (totalToday.filter((c: any) => c.status === "completed").length / totalToday.length) * 100 
          : 100
      };
    } catch (error: any) {
      logger.error("[MonitoringRouter] Failed to get real-time stats", { tenantId: ctx.tenantId!, error });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de récupérer les stats" });
    }
  })
});
