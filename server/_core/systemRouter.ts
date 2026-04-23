import { z } from "zod";
import { notifyOwner } from "./notification";
import { publicProcedure, router } from "./trpc";
import { adminProcedure, superAdminProcedure } from "../procedures";
import { HealthService } from "../services/healthService";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";

const healthStatusSchema = z.object({
  status: z.enum(["ok", "error", "degraded"]),
  timestamp: z.string(),
  version: z.string(),
  checks: z.object({
    database: z.object({ status: z.string(), latency_ms: z.number(), message: z.string().optional() }),
    redis: z.object({ status: z.string(), latency_ms: z.number(), message: z.string().optional() }),
    bullmq: z.object({ status: z.string(), latency_ms: z.number(), message: z.string().optional() }),
    ia: z.object({ status: z.string(), latency_ms: z.number(), message: z.string().optional() }),
    notifications: z.object({ status: z.string(), latency_ms: z.number(), message: z.string().optional() }),
    system: z.object({
      disk: z.string(),
      memory: z.string(),
      uptime: z.string(),
    }),
  }),
});

/**
 * System Router — Thin Router
 * ✅ BLOC 3 FIX: Architecture API -> Service -> Domain -> Infra
 */
export const systemRouter = router({
  /**
   * Vérifie la santé globale du système
   */
  health: publicProcedure
    .input(z.object({ timestamp: z.number().optional() }).optional())
    .output(healthStatusSchema)
    .query(async () => {
      try {
        return await HealthService.getFullStatus();
      } catch (error: unknown) {
        logger.error("[SystemRouter] Health check failed", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Health check failed" });
      }
    }),

  /**
   * Récupère les métriques système (Admin uniquement)
   */
  metrics: adminProcedure
    .output(z.any())
    .query(async () => {
      try {
        const { metrics: metricsService } = await import("../services/metricsService");
        return metricsService.getStats();
      } catch (error: unknown) {
        logger.error("[SystemRouter] Failed to get metrics", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get metrics" });
      }
    }),

  /**
   * Notifie le propriétaire du système (Admin uniquement)
   */
  notifyOwner: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string().min(1),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      try {
        const delivered = await notifyOwner(input);
        return { success: !!delivered };
      } catch (error: unknown) {
        logger.error("[SystemRouter] Failed to notify owner", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to notify owner" });
      }
    }),

  /**
   * Maintenance système (SuperAdmin uniquement)
   */
  maintenance: superAdminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      logger.warn(`[SystemRouter] Maintenance mode ${input.enabled ? 'ENABLED' : 'DISABLED'}`);
      // Logique de maintenance à implémenter si nécessaire
      return { success: true };
    }),
});
