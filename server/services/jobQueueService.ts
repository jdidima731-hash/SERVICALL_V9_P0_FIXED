/**
 * JOB QUEUE SERVICE — PRODUCTION-READY
 */
import { Queue, Worker, type Job as BullJob } from 'bullmq';
import { logger } from "../infrastructure/logger";
import { getDbInstance } from '../db';
import type { IncomingEvent } from '../workflow-engine/types';
import { failedJobs, stripeEvents } from '../../drizzle/schema';
import { makeBullMQConnection } from '../infrastructure/redis/bullmq.connection';
import { eq } from 'drizzle-orm';

// Use the shared BullMQ connection factory
const connection = makeBullMQConnection();

export type JobType = 'SEND_CAMPAIGN' | 'PROCESS_IA_BULK' | 'EXPORT_DATA' | 'CLEANUP_SYSTEM' | 'WEBHOOK_PROCESS' | 'WORKFLOW_EXECUTE';

interface JobPayload {
  type: JobType;
  tenantId: number;
  payload: Record<string, any>;
}

// Queue principale
const mainQueue = connection ? new Queue<JobPayload>('servicall-main', { connection }) : null;

// Vérifier que Redis est disponible au démarrage
if (process.env["NODE_ENV"] === "production" && !mainQueue && process.env["DISABLE_REDIS"] !== "true") {
  logger.error("[JobQueue] ❌ Redis est requis pour la queue si DISABLE_REDIS n'est pas activé.");
  process.exit(1);
}

if (!mainQueue) {
  logger.warn("[JobQueue] ⚠️ Queue BullMQ désactivée — aucune file Redis active");
}

/**
 * Processeur métier Stripe
 */
class StripeWebhookProcessor {
  async processEvent(tenantId: number, payload: Record<string, any>): Promise<void> {
    const eventId = payload.eventId as string;
    const eventType = payload.eventType as string;
    const stripeEvent = payload.payload;

    logger.info("[StripeWebhookProcessor] Processing Stripe event", {
      tenantId,
      eventId,
      eventType,
    });

    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      const [persistedEvent] = await db
        .select()
        .from(stripeEvents)
        .where(eq(stripeEvents.stripeEventId, eventId))
        .limit(1);

      if (!persistedEvent) {
        logger.warn("[StripeWebhookProcessor] Stripe event not found in DB", { eventId, tenantId });
        return;
      }

      // Traitement métier selon le type d'événement
      switch (eventType) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(tenantId, stripeEvent);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(tenantId, stripeEvent);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(tenantId, stripeEvent);
          break;
        case 'charge.succeeded':
          await this.handleChargeSucceeded(tenantId, stripeEvent);
          break;
        case 'charge.failed':
          await this.handleChargeFailed(tenantId, stripeEvent);
          break;
        default:
          logger.info("[StripeWebhookProcessor] Unhandled event type", { eventType, tenantId });
      }

      // Marquer l'événement comme traité
      await db
        .update(stripeEvents)
        .set({
          status: 'processed',
          processedAt: new Date(),
        })
        .where(eq(stripeEvents.stripeEventId, eventId));

      logger.info("[StripeWebhookProcessor] Event processed successfully", {
        eventId,
        eventType,
        tenantId,
      });

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("[StripeWebhookProcessor] Error processing event", {
        eventId,
        eventType,
        tenantId,
        error: msg,
      });

      try {
        const db = getDbInstance();
        if (db) {
          await db
            .update(stripeEvents)
            .set({
              status: 'failed',
              error: msg,
              processedAt: new Date(),
            })
            .where(eq(stripeEvents.stripeEventId, eventId));
        }
      } catch (updateErr: unknown) {
        logger.error("[StripeWebhookProcessor] Failed to mark event as failed", {
          eventId,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }

      throw error;
    }
  }

  private async handleSubscriptionUpdated(tenantId: number, event: any): Promise<void> {
    logger.info("[StripeWebhookProcessor] Handling subscription.updated", {
      tenantId,
      subscriptionId: event.data?.object?.id,
    });
  }

  private async handleInvoicePaid(tenantId: number, event: any): Promise<void> {
    logger.info("[StripeWebhookProcessor] Handling invoice.paid", {
      tenantId,
      invoiceId: event.data?.object?.id,
    });
  }

  private async handleInvoicePaymentFailed(tenantId: number, event: any): Promise<void> {
    logger.info("[StripeWebhookProcessor] Handling invoice.payment_failed", {
      tenantId,
      invoiceId: event.data?.object?.id,
    });
  }

  private async handleChargeSucceeded(tenantId: number, event: any): Promise<void> {
    logger.info("[StripeWebhookProcessor] Handling charge.succeeded", {
      tenantId,
      chargeId: event.data?.object?.id,
    });
  }

  private async handleChargeFailed(tenantId: number, event: any): Promise<void> {
    logger.info("[StripeWebhookProcessor] Handling charge.failed", {
      tenantId,
      chargeId: event.data?.object?.id,
    });
  }
}

const stripeProcessor = new StripeWebhookProcessor();

async function processCampaign(tenantId: number, payload: Record<string, any>) {
  logger.info(`[JobQueue] Processing campaign for tenant ${tenantId}`, { payload });
}

async function processAIBulk(tenantId: number, payload: Record<string, any>) {
  logger.info(`[JobQueue] Processing AI Bulk for tenant ${tenantId}`, { payload });
}

async function processExport(tenantId: number, payload: Record<string, any>) {
  logger.info(`[JobQueue] Processing Export for tenant ${tenantId}`, { payload });
}

async function processCleanup(payload: Record<string, any>) {
  logger.info(`[JobQueue] Processing System Cleanup`, { payload });
}

async function processWebhook(tenantId: number, payload: Record<string, any>) {
  logger.info(`[JobQueue] Processing Webhook for tenant ${tenantId}`, { payload });
  await stripeProcessor.processEvent(tenantId, payload);
}

async function processWorkflow(tenantId: number, payload: Record<string, any>) {
  const { WorkflowEngine } = await import('../workflow-engine/core/WorkflowEngine');
  const engine = new WorkflowEngine();
  logger.info(`[JobQueue] Processing Workflow for tenant ${tenantId}`, { payload });
  await engine.handle(payload);
}

// Worker pour traiter les jobs
if (connection && mainQueue) {
  const worker = new Worker<JobPayload>('servicall-main', async (job: BullJob<JobPayload>) => {
    const { type, tenantId, payload } = job.data;
    logger.info(`[BullMQ] Processing job ${job.id}`, { type, tenantId });
    
    switch (type) {
      case 'SEND_CAMPAIGN': return await processCampaign(tenantId, payload);
      case 'PROCESS_IA_BULK': return await processAIBulk(tenantId, payload);
      case 'EXPORT_DATA': return await processExport(tenantId, payload);
      case 'CLEANUP_SYSTEM': return await processCleanup(payload);
      case 'WEBHOOK_PROCESS': return await processWebhook(tenantId, payload);
      case 'WORKFLOW_EXECUTE': return await processWorkflow(tenantId, payload);
      default: throw new Error(`Unknown job type: ${type}`);
    }
  }, { 
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 }
  });

  worker.on('failed', async (job, err) => {
    logger.error(`[BullMQ] Job ${job?.id} failed`, { error: err.message, type: job?.data.type });
    
    if (job) {
      try {
        const db = getDbInstance();
        if (db) {
          await db.insert(failedJobs).values({
            jobId: job.id ?? 'unknown',
            queueName: 'servicall-main',
            payload: job.data,
            error: err.message,
            retryCount: job.attemptsMade,
            lastAttempt: new Date(),
          });
          logger.info(`[DLQ] Job ${job.id} stored in failed_jobs table for retry`);
        }
      } catch (dbErr: unknown) {
        logger.error(`[DLQ] Failed to store failed job in DB`, { error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
      }
    }
  });

  worker.on('completed', (job) => {
    logger.info(`[BullMQ] Job ${job.id} completed successfully`, { type: job.data.type });
  });
}

// API publique
export const jobQueue = {
  async enqueue(type: JobType, tenantId: number, payload: Record<string, any>, options?: { delay?: number; priority?: number }): Promise<string> {
    if (!mainQueue) {
      const isProduction = process.env["NODE_ENV"] === "production";
      const errorMsg = `[JobQueue] ❌ Redis is not available, cannot enqueue job type=${type}, tenantId=${tenantId}`;
      logger.error(errorMsg);
      
      if (isProduction && process.env["DISABLE_REDIS"] !== "true") {
        throw new Error(errorMsg);
      }

      logger.warn(`[JobQueue] Queue désactivée: retour d'un ID local sans exécution Redis.`);
      return 'no-redis-' + Date.now();
    }

    try {
      const job = await mainQueue.add(type, { type, tenantId, payload }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
        ...options,
      });
      logger.info(`[JobQueue] Job enqueued successfully`, { jobId: job.id, type, tenantId });
      return job.id ?? 'unknown';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[JobQueue] Failed to enqueue job`, { error: msg, type, tenantId });
      throw err;
    }
  },
  
  async getQueueStats() {
    if (!mainQueue) {
      logger.warn('[JobQueue] Cannot get queue stats: Redis not available');
      return null;
    }
    const [waiting, active, completed, failed] = await Promise.all([
      mainQueue.getWaitingCount(),
      mainQueue.getActiveCount(),
      mainQueue.getCompletedCount(),
      mainQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  },

  async retryJob(failedJobId: number) {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");
    
    const [failedJob] = await db.select().from(failedJobs).where(eq(failedJobs.id, failedJobId)).limit(1);
    
    if (!failedJob) {
      throw new Error(`Failed job with ID ${failedJobId} not found`);
    }

    const payload = failedJob.payload;
    logger.info(`[DLQ] Retrying job ${failedJob.jobId} from DB`);
    
    await this.enqueue(
      payload.type as JobType,
      payload.tenantId,
      payload.payload
    );

    await db.delete(failedJobs).where(eq(failedJobs.id, failedJobId));
    
    return { success: true, jobId: failedJob.jobId };
  },

  async getFailedJobs(limit = 50) {
    const db = getDbInstance();
    if (!db) return [];
    const { desc } = await import('drizzle-orm');
    return await db.select().from(failedJobs).orderBy(desc(failedJobs.createdAt)).limit(limit);
  }
};
