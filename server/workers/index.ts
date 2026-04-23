/**
 * WORKERS INDEX — SÉCURISÉ (Phase 1.4)
 * Chaque worker démarre dans un try/catch indépendant.
 * Un échec de worker ne bloque pas le serveur.
 */
import { logger } from "../infrastructure/logger";

let roiIntervalId: ReturnType<typeof setInterval> | null = null;
let weeklyReportIntervalId: ReturnType<typeof setInterval> | null = null;

function isWeeklyReportTime(): boolean {
  const now = new Date();
  return now.getUTCDay() === 1 && now.getUTCHours() === 8;
}

async function startVoiceWorker(): Promise<void> {
  try {
    const { startVoiceProcessingWorker } = await import("./voiceProcessingWorker");
    startVoiceProcessingWorker();
    logger.info("[Workers] Voice processing worker started");
  } catch (e: any) {
    logger.warn("[Workers] Voice processing worker non démarré (Redis absent ?)", { error: e });
  }
}

async function startROICronJob(): Promise<void> {
  try {
    const { ROICacheJob } = await import("../services/roiCacheJob");
    // ✅ CORRIGÉ (Audit Senior) : Délai de 30s pour laisser la DB et les migrations se stabiliser
    setTimeout(() => {
      ROICacheJob.run().catch((e: any) => 
        logger.error("[Workers] ROI cache boot run failed", e)
      );
    }, 30_000);
    roiIntervalId = setInterval(() => {
      ROICacheJob.run().catch((e: any) => logger.error("[Workers] ROI cache job failed", e));
    }, 60 * 60 * 1000);
    logger.info("[Workers] ROI cache cron started (every 1h)");
  } catch (e: any) {
    logger.warn("[Workers] ROI cache cron non démarré", { error: e });
  }
}

async function startWeeklyReportCron(): Promise<void> {
  if (process.env["ENABLE_WEEKLY_REPORT"] !== "true") {
    logger.info("[Workers] Weekly report cron DISABLED (ENABLE_WEEKLY_REPORT != true)");
    return;
  }
  try {
    const { WeeklyReportService } = await import("../services/weeklyReportService");
    weeklyReportIntervalId = setInterval(() => {
      if (isWeeklyReportTime()) {
        WeeklyReportService.sendToAllActiveTenants().catch((e: any) =>
          logger.error("[Workers] Weekly report job failed", e)
        );
      }
    }, 5 * 60 * 1000);
    logger.info("[Workers] Weekly report cron started (checks every 5min, fires Monday 8h UTC)");
  } catch (e: any) {
    logger.warn("[Workers] Weekly report cron non démarré", { error: e });
  }
}

/**
 * Démarre tous les workers. Ne throw jamais.
 */
let ownerBriefingIntervalId: ReturnType<typeof setInterval> | null = null;

async function startOwnerBriefingCron(): Promise<void> {
  if (process.env["ENABLE_OWNER_WHATSAPP_BRIEFING"] === "false") {
    logger.info("[Workers] Owner WhatsApp briefing cron DISABLED");
    return;
  }
  try {
    const { sendOwnerMorningBriefing, extractOwnerConfig } = await import("../services/whatsappOwnerCronService");
    const dbModule = await import("../db");
    const { tenants } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    async function runBriefing() {
      const now = new Date();
      // Lancer à 8h00 UTC (ou configurable)
      if (now.getUTCHours() !== 8 || now.getUTCMinutes() > 5) return;

      try {
        const db = dbModule.getDbInstance();
        const allTenants = await db
          .select({ id: tenants.id, name: tenants.name, settings: tenants.settings })
          .from(tenants)
          .where(eq(tenants.isActive, true));

        for (const tenant of allTenants) {
          const config = extractOwnerConfig(tenant.id, tenant.name, tenant.settings);
          if (config) {
            await sendOwnerMorningBriefing(config).catch((e: any) =>
              logger.warn("[Workers] Owner briefing failed for tenant", { tenantId: tenant.id, err: e.message })
            );
          }
        }
      } catch (e: any) {
        logger.error("[Workers] Owner briefing cron run failed", { err: e.message });
      }
    }

    // Check toutes les 5 minutes
    ownerBriefingIntervalId = setInterval(runBriefing, 5 * 60 * 1000);
    logger.info("[Workers] Owner WhatsApp briefing cron started (check every 5min)");
  } catch (e: any) {
    logger.warn("[Workers] Owner briefing cron non démarré", { error: e.message });
  }
}

export async function startAllWorkers(): Promise<void> {
  logger.info("[Workers] Démarrage de tous les workers...");
  await Promise.allSettled([startVoiceWorker(), startROICronJob(), startWeeklyReportCron(), startOwnerBriefingCron()]);
  logger.info("[Workers] ✅ Workers initialisés");
}

export async function stopAllWorkers(): Promise<void> {
  logger.info("[Workers] Arrêt des workers...");
  try {
    const { stopVoiceProcessingWorker } = await import("./voiceProcessingWorker");
    await stopVoiceProcessingWorker();
  } catch (_e) { /* ignore */ }
  if (roiIntervalId) { clearInterval(roiIntervalId); roiIntervalId = null; }
  if (weeklyReportIntervalId) { clearInterval(weeklyReportIntervalId); weeklyReportIntervalId = null; }
  if (ownerBriefingIntervalId) { clearInterval(ownerBriefingIntervalId); ownerBriefingIntervalId = null; }
  logger.info("[Workers] ✅ Workers arrêtés");
}

// Re-exports pour compatibilité
export { voiceProcessingQueue, enqueueVoiceJob } from "./voiceProcessingWorker";
