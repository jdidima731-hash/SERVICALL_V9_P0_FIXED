/**
 * Script CRON pour le nettoyage automatique RGPD des entretiens de recrutement
 * À exécuter quotidiennement pour anonymiser les données expirées
 * 
 * Usage: tsx server/scripts/recruitment-rgpd-cleanup.ts
 * Cron: 0 2 * * * (tous les jours à 2h du matin)
 */

import { recruitmentRGPDService } from "../services/recruitmentRGPDService";
import { logger } from "../infrastructure/logger";
import * as Sentry from "@sentry/node";

async function main() {
  try {
    logger.info("[CRON] Starting recruitment RGPD cleanup");

    // Nettoyer les entretiens expirés
    await recruitmentRGPDService.cleanExpiredInterviews();

    logger.info("[CRON] Recruitment RGPD cleanup completed successfully");
    process.exit(0);
  } catch (error: any) {
    logger.error("[CRON] Recruitment RGPD cleanup failed", { error });
    Sentry.captureException(error);
    process.exit(1);
  }
}

main();
