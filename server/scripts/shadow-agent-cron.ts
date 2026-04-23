/**
 * BLOC 3 - Shadow Agent Cron Job
 * Détecte automatiquement les appels manqués et génère des suggestions
 * À exécuter périodiquement (ex: toutes les heures)
 */

import { ShadowAgentService } from "../services/shadowAgentService";
import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

async function runShadowAgentCron() {
  logger.info("[Shadow Agent Cron] Starting...");

  try {
    const db = getDbInstance();

    // Récupérer tous les tenants actifs
    const tenants = await db
      .select()
      .from(schema.tenants)
      .where(schema.tenants.isActive);

    logger.info("[Shadow Agent Cron] Processing tenants", { 
      count: tenants.length 
    });

    let totalSuggestions = 0;

    // Pour chaque tenant, détecter les appels manqués
    for (const tenant of tenants) {
      try {
        const suggestions = await ShadowAgentService.detectMissedCallsAndSuggest(
          tenant.id
        );

        totalSuggestions += suggestions.length;

        logger.info("[Shadow Agent Cron] Processed tenant", {
          tenantId: tenant.id,
          tenantName: tenant.name,
          suggestionsCreated: suggestions.length,
        });
      } catch (error: any) {
        logger.error("[Shadow Agent Cron] Failed to process tenant", {
          error,
          tenantId: tenant.id,
        });
      }
    }

    logger.info("[Shadow Agent Cron] Completed", {
      tenantsProcessed: tenants.length,
      totalSuggestions,
    });

    process.exit(0);
  } catch (error: any) {
    logger.error("[Shadow Agent Cron] Fatal error", { error });
    process.exit(1);
  }
}

// Exécuter le cron
runShadowAgentCron();
