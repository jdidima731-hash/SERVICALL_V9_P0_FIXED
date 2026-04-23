/**
 * ROI CACHE JOB
 * Pré-calcul et mise en cache des métriques ROI par tenant
 */

import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { tenants } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { set as cacheSet } from "./cacheService";

const ROI_CACHE_TTL = 3600; // 1 heure

async function computeRoiForTenant(tenantId: number): Promise<Record<string, unknown>> {
  const db = getDbInstance();

  // Agrégats de base : appels, rendez-vous, conversions sur les 30 derniers jours
  const [callStats] = await db.execute<{ total: number; converted: number }>(
    `SELECT 
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE outcome = 'converted')::int AS converted
     FROM calls
     WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
  ).catch(() => [{ total: 0, converted: 0 }]) as [{ total: number; converted: number }];

  const conversionRate = callStats.total > 0
    ? (callStats.converted / callStats.total) * 100
    : 0;

  return {
    tenantId,
    conversionRate: Math.round(conversionRate * 100) / 100,
    totalCalls: callStats.total,
    convertedCalls: callStats.converted,
    computedAt: new Date().toISOString(),
  };
}

export const ROICacheJob = {
  async run(): Promise<void> {
    logger.info("[ROICacheJob] Starting ROI cache computation");
    try {
      const db = getDbInstance();
      const allTenants = await db.select({ id: tenants.id }).from(tenants)
        .where(eq(tenants.isActive, true));

      // ✅ CORRIGÉ (Audit Senior) : Garde défensive si la DB n'est pas encore prête ou vide
      if (!Array.isArray(allTenants)) {
        logger.warn("[ROICacheJob] allTenants non iterable — DB probablement non prête ou schéma non migré");
        return;
      }

      let processed = 0;
      for (const tenant of allTenants) {
        try {
          const roiData = await computeRoiForTenant(tenant.id);
          await cacheSet(`roi:tenant:${tenant.id}`, roiData, { ttl: ROI_CACHE_TTL });
          processed++;
        } catch (err: any) {
          logger.warn("[ROICacheJob] Failed for tenant", { tenantId: tenant.id, err });
        }
      }

      logger.info(`[ROICacheJob] Completed — ${processed}/${allTenants.length} tenants updated`);
    } catch (error: any) {
      logger.error("[ROICacheJob] Fatal error", { error });
      throw error;
    }
  },
};
