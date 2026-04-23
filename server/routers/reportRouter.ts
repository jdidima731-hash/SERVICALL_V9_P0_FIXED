import { router, tenantProcedure, managerProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ReportingService } from "../services/reportingService";

/**
 * Report Router — Thin Router
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 * ✅ Logic moved to ReportingService
 */
export const reportRouter = router({
  /**
   * Statistiques globales d'appels pour le tenant
   */
  getCallStats: tenantProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return await ReportingService.getCallStats(ctx.tenantId, input.startDate, input.endDate);
    }),

  /**
   * Performance détaillée par agent (nécessite manager)
   */
  getAgentPerformance: managerProcedure
    .input(z.object({
      agentId: z.number().optional(),
      timeRange: z.enum(["7d", "30d", "90d"]).default("30d"),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return await ReportingService.getAgentPerformance(ctx.tenantId, input);
    }),

  /**
   * Export des données d'appels en CSV (nécessite manager)
   */
  exportCallData: managerProcedure
    .input(z.object({
      format: z.enum(["csv", "json"]).default("csv"),
    }))
    .mutation(async ({ ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const data = await ReportingService.exportCallData(ctx.tenantId);

      if (data.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aucune donnée à exporter",
        });
      }

      return {
        message: "Export généré avec succès",
        count: data.length,
        data: data,
      };
    }),
});
