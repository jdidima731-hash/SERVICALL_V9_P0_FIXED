import { Queue, Worker } from "bullmq";
import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { makeBullMQConnection } from "../infrastructure/redis/bullmq.connection";
import { withScope, setTag, captureException as sentryCaptureException } from "@sentry/node";


/**
 * Service de gestion des queues asynchrones avec BullMQ
 * Permet de traiter les tâches longues en arrière-plan
 * ✅ BLOC 2: Extension des types de jobs (LeadExtraction, LeadImport)
 */

// ✅ Variables globales pour les queues
let queuesInitialized = false;

// Définir les types de queues disponibles
export type QueueType =
  | "sms-campaigns"
  | "email-campaigns"
  | "call-analysis"
  | "report-generation"
  | "ai-transcription"
  | "sentiment-analysis"
  | "appointment-reminders"
  | "invoice-generation"
  | "outbound-calls";

/**
 * Queues disponibles (initialisées à null)
 */
export const queues = {
  smsCampaigns: null as Queue | null,
  emailCampaigns: null as Queue | null,
  callAnalysis: null as Queue | null,
  reportGeneration: null as Queue | null,
  aiTranscription: null as Queue | null,
  sentimentAnalysis: null as Queue | null,
  appointmentReminders: null as Queue | null,
  invoiceGeneration: null as Queue | null,
  outboundCalls: null as Queue | null,
};

/**
 * Mapping explicite et type-safe pour les noms de queues
 */
const QUEUE_NAME_MAP: Record<QueueType, keyof typeof queues> = {
  "sms-campaigns": "smsCampaigns",
  "email-campaigns": "emailCampaigns",
  "call-analysis": "callAnalysis",
  "report-generation": "reportGeneration",
  "ai-transcription": "aiTranscription",
  "sentiment-analysis": "sentimentAnalysis",
  "appointment-reminders": "appointmentReminders",
  "invoice-generation": "invoiceGeneration",
  "outbound-calls": "outboundCalls",
};

function getQueueKey(queueName: QueueType): keyof typeof queues {
  const key = QUEUE_NAME_MAP[queueName];
  if (!key) throw new Error(`Unknown queue name: ${queueName}`);
  return key;
}

/**
 * Créer une queue
 */
function createQueue(queueName: QueueType): Queue | null {
  try {
    const bullConn = makeBullMQConnection();
    if (!bullConn) return null;
    return new Queue(queueName, {
      connection: bullConn,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });
  } catch (error: any) {
    logger.error(`[QueueService] Impossible de créer la queue ${queueName}`, { error });
    return null;
  }
}

/**
 * Initialiser toutes les queues
 */
export function initializeQueues(): void {
  if (queuesInitialized) return;

  try {
    queues.smsCampaigns = createQueue("sms-campaigns");
    queues.emailCampaigns = createQueue("email-campaigns");
    queues.callAnalysis = createQueue("call-analysis");
    queues.reportGeneration = createQueue("report-generation");
    queues.aiTranscription = createQueue("ai-transcription");
    queues.sentimentAnalysis = createQueue("sentiment-analysis");
    queues.appointmentReminders = createQueue("appointment-reminders");
    queues.invoiceGeneration = createQueue("invoice-generation");
    queues.outboundCalls = createQueue("outbound-calls");

    queuesInitialized = true;
    logger.info("[QueueService] All queues initialized successfully");
  } catch (error: any) {
    logger.error("[QueueService] Failed to initialize queues", { error });
    throw error;
  }
}

/**
 * Ajouter un job à une queue
 */
export async function addJob<T>(
  queueName: QueueType,
  jobData: T,
  options?: {
    delay?: number;
    priority?: number;
    repeat?: { pattern?: string; every?: number };
  }
) {
  if (!queuesInitialized) initializeQueues();

  try {
    const queueKey = getQueueKey(queueName);
    const queue = queues[queueKey];
    if (!queue) throw new Error(`Queue ${queueName} not initialized`);

    // ✅ Génération d'un jobId pour l'idempotence basé sur les données du job
    const crypto = await import("crypto");
    const jobId = (crypto as unknown).createHash("sha256").update(JSON.stringify(jobData)).digest("hex");

    const job = await queue.add(queueName, jobData, {
      jobId, // ✅ Idempotence
      delay: options?.delay,
      priority: options?.priority,
      repeat: options?.repeat,
    });

    logger.info(`[QueueService] Job added to ${queueName}`, { jobId: job.id });
    return job;
  } catch (error: any) {
    logger.error(`[QueueService] Failed to add job to ${queueName}`, { error });
    throw error;
  }
}

/**
 * Enregistrer un worker
 */
export function registerWorker(
  queueName: QueueType,
  processor: (jobData: any) => Promise<any>
) {
  try {
    const bullConn = makeBullMQConnection();
    if (!bullConn) throw new Error("[QueueService] Redis non disponible pour le worker");
    const worker = new Worker(queueName, processor, {
      connection: bullConn,
      concurrency: parseInt(process.env["QUEUE_WORKER_CONCURRENCY"] ?? "5"),
      limiter: queueName === "outbound-calls" ? { max: 1, duration: 1000 } : undefined,
    });

    worker.on("completed", (job: any) => logger.info(`[QueueService] Job completed`, { queueName, jobId: job.id }));
    worker.on("failed", async (job, err) => {
      logger.error(`[QueueService] Job failed`, { queueName, jobId: job?.id, error: err.message });
      
      // ✅ BLOC 2: Enregistrer dans workflowDeadLetters
      if (job) {
        try {
          const dbMod = await import("../db");
          const database = await dbMod.getDb();
          if (database) {
            const { workflowDeadLetters } = await import("../../drizzle/schema");
            await database.insert(workflowDeadLetters).values({
              tenantId: job.data.tenantId || 0,
              jobId: job.id || "unknown",
              queueName: queueName,
              payload: job.data,
              error: err.message,
              stack: err.stack,
              attempts: job.attemptsMade,
              status: "failed",
            });
          }
        } catch (dbErr) {
          logger.error("[QueueService] Failed to log dead letter", dbErr);
        }
      }

      // ✅ Bloc 9: Metrics BullMQ
      import("./metricsService").then(m => m.bullmqJobsFailed.labels(queueName).inc());

      withScope((scope) => {
        scope.setTag("queue", queueName);
        scope.setTag("jobId", job?.id);
        scope.setContext("jobData", job?.data);
        if (job?.data?.tenantId) scope.setTag("tenantId", job.data.tenantId);
        if (job?.data?.userId) scope.setUser({ id: job.data.userId });
        sentryCaptureException(err);
      });
    });
    worker.on("error", (err) => {
      logger.error(`[QueueService] Worker error`, { queueName, error: err.message });
      setTag("queue", queueName);
      sentryCaptureException(err);
    });

    logger.info(`[QueueService] Worker registered for ${queueName}`);
    return worker;
  } catch (error: any) {
    logger.error(`[QueueService] Failed to register worker for ${queueName}`, { error });
    throw error;
  }
}

/**
 * Récupérer le statut d'une queue
 */
export async function getQueueStats(queueName: QueueType) {
  if (!queuesInitialized) return null;

  try {
    const queueKey = getQueueKey(queueName);
    const queue = queues[queueKey];
    if (!queue) throw new Error(`Queue ${queueName} not initialized`);

    const counts = await queue.getJobCounts();
    return { queueName, ...counts };
  } catch (error: any) {
    logger.error(`[QueueService] Failed to get queue stats for ${queueName}`, { error });
    throw error;
  }
}

/**
 * Initialiser tous les workers
 */
export async function initializeWorkers() {
  logger.info("[QueueService] Initializing workers...");
  initializeQueues();

  const hasOpenAI = Boolean(process.env['OPENAI_API_KEY']);
  const hasTwilio = Boolean(process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_AUTH_TOKEN']);
  const hasStripe = Boolean(process.env['STRIPE_SECRET_KEY']);

  // Enregistrement des workers
  if (hasTwilio) {
    registerWorker("sms-campaigns", async (job: any) => ({ sent: job.data.phoneNumbers.length }));
  }

  // Worker Email (Générique)
  registerWorker("email-campaigns", async (job: any) => {
    const { sendEmailInternal } = await import("./notificationService");
    if (job.data.type === "appointment-confirmation") {
      const { to, appointment } = job.data;
      const html = `<div>Rendez-vous : ${appointment.title}</div>`; // Simplifié pour l'exemple
      await sendEmailInternal({ to, subject: `Confirmation: ${appointment.title}`, html });
    } else {
      await sendEmailInternal({ 
        to: job.data.to, 
        subject: job.data.subject, 
        html: job.data.html || job.data.text 
      });
    }
    return { success: true };
  });

  if (hasOpenAI) {
    registerWorker("call-analysis", async (job: any) => {
      const { CallScoringService } = await import("./callScoringService");
      await CallScoringService.scoreCall(job.data.callId);
      return { callId: job.data.callId, analyzed: true };
    });
    registerWorker("ai-transcription", async (job: any) => ({ callId: job.data.callId, transcribed: true }));
    registerWorker("sentiment-analysis", async (job: any) => ({ callId: job.data.callId, sentiment: "neutral" }));
  }

  // Worker Report & Lead Extraction
  registerWorker("report-generation", async (job: any) => {
    if (job.data.type === "lead-extraction") {
      const { searchBusinesses } = await import("./leadExtractionService");
      return await searchBusinesses({ ...job.data.params, tenantId: job.data.tenantId });
    } else if (job.data.type === "lead-import") {
      const { importBusinessesAsProspects } = await import("./leadExtractionService");
      return await importBusinessesAsProspects(job.data.businesses, job.data.tenantId, job.data.extractionId);
    }
    return { reportType: job.data.reportType, generated: true };
  });

  registerWorker("appointment-reminders", async (job: any) => ({ appointmentId: job.data.appointmentId, sent: true }));
  
  if (hasStripe) {
    registerWorker("invoice-generation", async (job: any) => ({ invoiceId: job.data.invoiceId, generated: true }));
  }

  if (hasTwilio) {
    registerWorker("outbound-calls", async (job: any) => {
      const { createOutboundCallInternal } = await import("./twilioService");
      const call = await createOutboundCallInternal(job.data.toNumber, job.data.tenantId, job.data.prospectId, job.data.isAI);
      return { callSid: call.sid, status: "initiated" };
    });
  }
  logger.info("[QueueService] All workers initialized successfully");
}

export async function shutdownQueues() {
  if (!queuesInitialized) return;
  for (const queue of Object.values(queues)) {
    if (queue) await queue.close();
  }
  queuesInitialized = false;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    return true;
  } catch (error: any) {
    return false;
  }
}
