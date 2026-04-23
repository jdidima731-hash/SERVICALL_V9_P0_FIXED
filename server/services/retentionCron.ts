/**
 * Retention Cron - Automatisation de la politique de rétention RGPD
 */

import { RightToBeForgottenService } from "./RightToBeForgottenService";
import { logger } from "../infrastructure/logger";

/**
 * Exécute la politique de rétention tous les jours à minuit
 * Supprime les données de plus de 3 ans (1095 jours) par défaut
 * ✅ FIX H2 — retourne une fonction stop() pour pouvoir annuler le cron proprement
 */
export async function startRetentionCron(): Promise<() => void> {
  const RETENTION_DAYS = parseInt(process.env["RGPD_RETENTION_DAYS"] ?? "1095");
  
  logger.info(`[RGPD] Initializing retention cron (Retention: ${RETENTION_DAYS} days)`);

  // Exécution immédiate au démarrage pour vérification
  try {
    await RightToBeForgottenService.runRetentionPolicy(RETENTION_DAYS);
  } catch (error: any) {
    logger.error("[RGPD] Initial retention policy run failed", error);
  }

  // Planification quotidienne (toutes les 24 heures)
  const handle = setInterval(async () => {
    try {
      logger.info("[RGPD] Running scheduled retention policy...");
      await RightToBeForgottenService.runRetentionPolicy(RETENTION_DAYS);
    } catch (error: any) {
      logger.error("[RGPD] Scheduled retention policy failed", error);
    }
  }, 24 * 60 * 60 * 1000);

  // Retourner une fonction d'arrêt propre
  return () => {
    clearInterval(handle);
    logger.info("[RGPD] Retention cron stopped");
  };
}
