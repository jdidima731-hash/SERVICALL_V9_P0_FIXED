
/**
 * DIALER ENGINE — Moteur de campagnes d'appels prédictifs
 * Utilise BullMQ pour la file d'attente et Twilio pour les appels.
 *
 * Architecture :
 *  - Queue BullMQ "predictive-dialer" dans Redis
 *  - Worker concurrent (5 appels max simultanés)
 *  - Retry exponentiel (3 tentatives, délai 5 min)
 *  - Pacing aléatoire pour éviter les pics Twilio
 *  - makeCall via twilioService.ts (client partagé)
 */

import { Queue, Worker, Job, type ConnectionOptions } from "bullmq";
import { getRedisClient } from "../../infrastructure/redis/redis.client";
import { makeBullMQConnection } from "../../infrastructure/redis/bullmq.connection";
import { getDbInstance } from "../../db";
import { campaignProspects, calls, prospects as prospectsTable } from "../../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { makeCall } from "../twilioService";
import { logger } from "../../infrastructure/logger";
import { ENV } from "../../_core/env";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DialerConfig {
  pacingRatio?: number;       // Appels / agent (défaut 1)
  maxAttempts?: number;       // Tentatives max (défaut 3)
  retryDelayMs?: number;      // Délai entre tentatives (défaut 300 000 ms = 5 min)
  maxConcurrentCalls?: number; // Appels simultanés (défaut 5)
}

export interface CallJob {
  campaignId: number;
  prospectId: number;
  tenantId: number;
  phoneNumber: string;
  prospectName: string;
  attemptNumber: number;
}

// ─────────────────────────────────────────────
// Singleton engine
// ─────────────────────────────────────────────


// Local interface for optional injected Twilio override (forward-compat)
interface TwilioServiceOverride {
  makeCall?: (to: string, message?: string, tenantId?: number) => Promise<string>;
}


/**
 * optimalConcurrency — Calcule la concurrence optimale.
 * Min 1, Max 20 pour éviter la surcharge Twilio.
 */
function optimalConcurrency(maxConcurrentCalls?: number): number {
  const requested = maxConcurrentCalls ?? 5;
  return Math.max(1, Math.min(20, requested));
}

class DialerEngineService {
  private queues: Map<string, Queue<CallJob>> = new Map();
  private workers: Map<string, Worker<CallJob>> = new Map();
  // Optional overrides passed from index.ts — kept for forward-compat but
  // internal queues use getRedisClient() lazily per tenant.
  private readonly _redisUrl: string;
  private readonly _twilioService: TwilioServiceOverride | null;

  constructor(redisUrl?: string, twilioService?: TwilioServiceOverride | null) {
    this._redisUrl = redisUrl ?? "redis://localhost:6379";
    this._twilioService = twilioService ?? null;
  }

  /**
   * Validate that Redis is reachable. Called once at server startup.
   * Non-fatal: if Redis is unavailable, dialer runs in degraded mode.
   */
  async initialize(): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis && typeof (redis as { ping?: () => unknown }).ping === "function") {
        await (redis as { ping: () => Promise<unknown> }).ping();
      }
      logger.info("[Dialer] Engine initialized", { redisUrl: this._redisUrl });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("[Dialer] Engine initialized in degraded mode (Redis unavailable)", { error: msg });
    }
  }

  private getQueueName(tenantId: number): string {
    return `predictive-dialer:${tenantId}`;
  }

  private getOrCreateQueue(tenantId: number, maxConcurrentCalls?: number): Queue<CallJob> {
    const name = this.getQueueName(tenantId);
    if (!this.queues.has(name)) {
      const bullConn = makeBullMQConnection();
      if (!bullConn) throw new Error("Redis non disponible pour le dialer");
      const queue = new Queue<CallJob>(name, {
        connection: bullConn,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });
      this.queues.set(name, queue);

      // Démarrer le worker pour cette queue
      const worker = new Worker<CallJob>(name, this.processCall.bind(this), {
        connection: makeBullMQConnection()!,
        concurrency: optimalConcurrency(maxConcurrentCalls),
      });
      worker.on("completed", (job: any) => {
        logger.info(`[Dialer] Call job completed`, { jobId: job.id, campaignId: job.data.campaignId });
      });
      worker.on("failed", (job, err) => {
        logger.error(`[Dialer] Call job failed`, { jobId: job?.id, error: err.message });
      });
      this.workers.set(name, worker);
    }
    return this.queues.get(name)!;
  }

  /**
   * Démarrer une campagne — enfile tous les prospects en attente
   */
  async startCampaign(
    campaignId: number,
    tenantId: number,
    config: DialerConfig = {}
  ): Promise<{ queued: number }> {
    const { retryDelayMs = 300_000 } = config;
    const db = getDbInstance();
    if (!db) throw new Error("DB non disponible");

    // Récupérer les prospects pending de la campagne
    const campaignRows = await db
      .select({
        cpId: campaignProspects.id,
        prospectId: campaignProspects.prospectId,
        phoneNumber: campaignProspects.phoneNumber,
        name: campaignProspects.name,
      })
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.campaignId, campaignId),
          eq(campaignProspects.status, "pending")
        )
      );

    if (campaignRows.length === 0) {
      logger.warn(`[Dialer] No pending prospects for campaign ${campaignId}`);
      return { queued: 0 };
    }

    // Récupérer les infos prospect (téléphone + nom)
    const prospectIds = campaignRows
      .map(r => r.prospectId)
      .filter((id): id is number => id !== null);

    const prospectData = await db
      .select({
        id: prospectsTable.id,
        phone: prospectsTable.phone,
        firstName: prospectsTable.firstName,
        lastName: prospectsTable.lastName,
      })
      .from(prospectsTable)
      .where(inArray(prospectsTable.id, prospectIds));

    const prospectMap = new Map(prospectData.map((p: any) => [p.id, p]));

    const queue = this.getOrCreateQueue(tenantId, config.maxConcurrentCalls);
    let queued = 0;

    for (const row of campaignRows) {
      const prospect = row.prospectId ? prospectMap.get(row.prospectId) : null;
      // Téléphone : depuis la table prospects ou depuis la table campaign_prospects
      const phone = prospect?.phone ?? row.phoneNumber;
      if (!phone) continue;

      const job: CallJob = {
        campaignId,
        prospectId: row.prospectId ?? 0,
        tenantId,
        phoneNumber: phone,
        prospectName: prospect
          ? `${prospect.firstName ?? ""} ${prospect.lastName ?? ""}`.trim() || "Prospect"
          : (row.name ?? "Prospect"),
        attemptNumber: 1,
      };

      // Pacing : délai aléatoire entre 0 et 3s pour étaler les appels
      await queue.add(`call-${row.cpId}`, job, {
        delay: Math.floor(Math.random() * 3000 * queued),
      });
      queued++;
    }

    logger.info(`[Dialer] Campaign ${campaignId} started`, { tenantId, queued });
    return { queued };
  }

  /**
   * Worker : traitement d'un appel
   */
  private async processCall(job: Job<CallJob>): Promise<void> {
    const { campaignId, prospectId, tenantId, phoneNumber, attemptNumber } =
      job.data;

    logger.info(`[Dialer] Initiating call`, { campaignId, prospectId, phoneNumber, attempt: attemptNumber });

    const db = getDbInstance();
    if (!db) throw new Error("DB non disponible");

    // Marquer comme "en cours"
    await db
      .update(campaignProspects)
      .set({ 
        status: "dialing", 
        lastAttemptAt: new Date(), 
        callAttempts: attemptNumber 
      })
      .where(
        and(
          eq(campaignProspects.campaignId, campaignId),
          eq(campaignProspects.prospectId, prospectId)
        )
      );

    // Créer le log d'appel
    const [callRecord] = await db
      .insert(calls)
      .values({
        tenantId,
        campaignId,
        prospectId,
        callType: "outbound",
        direction: "outbound",
        status: "scheduled",
        toNumber: phoneNumber,
        fromNumber: ENV.twilioPhoneNumber ?? "",
        metadata: { source: "predictive_dialer", attempt: attemptNumber },
      })
      .returning({ id: calls.id });

    try {
      // Lancer l'appel via Twilio
      const callSid = await makeCall(phoneNumber, undefined, tenantId);

      // Mettre à jour le log d'appel
      await db
        .update(calls)
        .set({ callSid, status: "in_progress", startedAt: new Date() })
        .where(eq(calls.id, callRecord!.id));

      logger.info(`[Dialer] Call initiated`, { callSid, campaignId, prospectId });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[Dialer] Call failed`, { campaignId, prospectId, error: msg, attempt: attemptNumber });

      // Mettre à jour le log d'appel
      if (callRecord?.id) {
        await db
          .update(calls)
          .set({ status: "failed", endedAt: new Date() })
          .where(eq(calls.id, callRecord.id));
      }

      // Marquer comme failed après max tentatives
      await db
        .update(campaignProspects)
        .set({ status: "failed" })
        .where(
          and(
            eq(campaignProspects.campaignId, campaignId),
            eq(campaignProspects.prospectId, prospectId)
          )
        );

      throw err; // BullMQ va retenter selon la config
    }
  }

  /**
   * Arrêter une campagne — vider la queue
   */
  async stopCampaign(campaignId: number, tenantId: number): Promise<void> {
    const name = this.getQueueName(tenantId);
    const queue = this.queues.get(name);
    if (!queue) return;

    const jobs = await queue.getJobs(["active", "waiting", "delayed"]);
    const campaignJobs = jobs.filter(j => j.data.campaignId === campaignId);
    await Promise.all(campaignJobs.map(j => j.remove()));
    logger.info(`[Dialer] Campaign ${campaignId} stopped`, { removed: campaignJobs.length });
  }

  /**
   * Statut d'une campagne
   */
  async getCampaignStatus(campaignId: number, tenantId: number): Promise<{
    total: number;
    pending: number;
    dialing: number;
    completed: number;
    failed: number;
    queued: number;
  }> {
    const db = getDbInstance();
    if (!db) throw new Error("DB non disponible");

    const rows = await db
      .select({ status: campaignProspects.status })
      .from(campaignProspects)
      .where(eq(campaignProspects.campaignId, campaignId));

    const name = this.getQueueName(tenantId);
    const queue = this.queues.get(name);
    const queued = queue ? await queue.count() : 0;

    return {
      total: rows.length,
      pending: rows.filter(r => r.status === "pending").length,
      dialing: rows.filter(r => r.status === "dialing").length,
      completed: rows.filter(r => r.status === "completed").length,
      failed: rows.filter(r => r.status === "failed").length,
      queued,
    };
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.workers.values()].map(w => w.close()));
    await Promise.all([...this.queues.values()].map(q => q.close()));
    logger.info("[Dialer] Engine shut down");
  }
}

export const dialerEngine = new DialerEngineService();

// Type alias & class export for consumers that do `new DialerEngine(...)`
export { DialerEngineService as DialerEngine };
export type { DialerEngineService };
