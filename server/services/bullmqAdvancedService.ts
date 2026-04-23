import type { ConnectionOptions } from 'bullmq';

/**
 * Advanced BullMQ Service
 * Gestion des queues pour SMS, génération IA et workflows automatisés
 * ✅ PHASE 2 — Performance & Scalabilité
 */

import { Queue, Worker, QueueEvents } from "bullmq";
// redis import removed - not used directly
import { logger } from "../infrastructure/logger";
import { ENV } from "../_core/env";

export interface SMSQueueData {
  phoneNumber: string;
  content: string;
  tenantId: number;
  prospectId?: number;
  campaignId?: number;
  priority?: number;
}

export interface AIGenerationQueueData {
  prompt: string;
  tenantId: number;
  userId: number;
  type: "social_post" | "email" | "sms" | "call_script";
  priority?: number;
}

export interface WorkflowQueueData {
  workflowId: number;
  tenantId: number;
  prospectId: number;
  actionType: string;
  payload?: Record<string, any>;
  priority?: number;
}

const QUEUE_CONFIG = {
  connection: {
    host: ENV.redisHost ?? "localhost",
    port: typeof ENV.redisPort === 'number' ? ENV.redisPort : parseInt(String(ENV.redisPort) || "6379"),
    password: ENV.redisPassword,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
};

/**
 * Service de gestion des queues BullMQ avancées
 */
export class AdvancedBullMQService {
  private smsQueue: Queue<SMSQueueData>;
  private aiQueue: Queue<AIGenerationQueueData>;
  private workflowQueue: Queue<WorkflowQueueData>;

  private smsWorker: Worker<SMSQueueData> | null = null;
  private aiWorker: Worker<AIGenerationQueueData> | null = null;
  private workflowWorker: Worker<WorkflowQueueData> | null = null;

  constructor() {
    
    this.smsQueue = new Queue<SMSQueueData>("sms-queue", QUEUE_CONFIG as unknown);
    
    this.aiQueue = new Queue<AIGenerationQueueData>("ai-generation-queue", QUEUE_CONFIG as unknown);
    
    this.workflowQueue = new Queue<WorkflowQueueData>("workflow-queue", QUEUE_CONFIG as unknown);

    this.setupEventListeners();
  }

  /**
   * Configure les event listeners pour les queues
   */
  private setupEventListeners(): void {
    const queues = [
      { queue: this.smsQueue, name: "SMS" },
      { queue: this.aiQueue, name: "AI" },
      { queue: this.workflowQueue, name: "Workflow" },
    ];

    queues.forEach(({ queue, name }) => {
      
      const events = new QueueEvents(queue.name, QUEUE_CONFIG as unknown);

      events.on("completed", ({ jobId }) => {
        logger.debug(`[BullMQ] ${name} job completed`, { jobId });
      });

      events.on("failed", ({ jobId, failedReason }) => {
        logger.error(`[BullMQ] ${name} job failed`, { jobId, reason: failedReason });
      });

      events.on("stalled", ({ jobId }) => {
        logger.warn(`[BullMQ] ${name} job stalled`, { jobId });
      });
    });
  }

  /**
   * Ajoute un job d'envoi SMS à la queue
   */
  async enqueueSMS(data: SMSQueueData): Promise<string> {
    try {
      const job = await this.smsQueue.add("send-sms", data, {
        priority: data.priority ?? 5,
        jobId: `sms-${data.tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      });
      logger.info("[BullMQ] SMS job enqueued", { jobId: job.id, phoneNumber: data.phoneNumber });
      return job.id as string;
    } catch (error: unknown) {
      logger.error("[BullMQ] Error enqueueing SMS", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Ajoute un job de génération IA à la queue
   */
  async enqueueAIGeneration(data: AIGenerationQueueData): Promise<string> {
    try {
      const job = await this.aiQueue.add("generate-ai", data, {
        priority: data.priority ?? 3,
        jobId: `ai-${data.tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      });
      logger.info("[BullMQ] AI generation job enqueued", { jobId: job.id, type: data.type });
      return job.id as string;
    } catch (error: unknown) {
      logger.error("[BullMQ] Error enqueueing AI generation", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Ajoute un job de workflow à la queue
   */
  async enqueueWorkflow(data: WorkflowQueueData): Promise<string> {
    try {
      const job = await this.workflowQueue.add("execute-workflow", data, {
        priority: data.priority ?? 5,
        jobId: `workflow-${data.tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      });
      logger.info("[BullMQ] Workflow job enqueued", { jobId: job.id, workflowId: data.workflowId });
      return job.id as string;
    } catch (error: unknown) {
      logger.error("[BullMQ] Error enqueueing workflow", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Démarre les workers
   */
  async startWorkers(): Promise<void> {
    try {
      // SMS Worker
      this.smsWorker = new Worker<SMSQueueData>(
        "sms-queue",
        async (job: any) => {
          logger.info("[BullMQ] Processing SMS job", { jobId: job.id });
          // Implémentation du traitement SMS
          await new Promise<void>((resolve: any) => setTimeout(resolve, 1000));
          return { success: true, jobId: job.id };
        },
        
        QUEUE_CONFIG as unknown
      );

      // AI Generation Worker
      this.aiWorker = new Worker<AIGenerationQueueData>(
        "ai-generation-queue",
        async (job: any) => {
          logger.info("[BullMQ] Processing AI generation job", { jobId: job.id });
          // Implémentation de la génération IA
          await new Promise<void>((resolve: any) => setTimeout(resolve, 2000));
          return { success: true, jobId: job.id };
        },
        
        QUEUE_CONFIG as unknown
      );

      // Workflow Worker
      this.workflowWorker = new Worker<WorkflowQueueData>(
        "workflow-queue",
        async (job: any) => {
          logger.info("[BullMQ] Processing workflow job", { jobId: job.id });
          // Implémentation de l'exécution du workflow
          await new Promise<void>((resolve: any) => setTimeout(resolve, 1500));
          return { success: true, jobId: job.id };
        },
        
        QUEUE_CONFIG as unknown
      );

      logger.info("[BullMQ] All workers started");
    } catch (error: unknown) {
      logger.error("[BullMQ] Error starting workers", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Arrête les workers
   */
  async stopWorkers(): Promise<void> {
    try {
      if (this.smsWorker) await this.smsWorker.close();
      if (this.aiWorker) await this.aiWorker.close();
      if (this.workflowWorker) await this.workflowWorker.close();
      logger.info("[BullMQ] All workers stopped");
    } catch (error: unknown) {
      logger.error("[BullMQ] Error stopping workers", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Récupère les statistiques des queues
   */
  async getStats(): Promise<any> {
    try {
      const smsStats = await this.smsQueue.getJobCounts();
      const aiStats = await this.aiQueue.getJobCounts();
      const workflowStats = await this.workflowQueue.getJobCounts();

      return {
        sms: smsStats,
        ai: aiStats,
        workflow: workflowStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      logger.error("[BullMQ] Error getting stats", { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Vide une queue
   */
  async flushQueue(queueName: "sms" | "ai" | "workflow"): Promise<void> {
    try {
      const queue =
        queueName === "sms"
          ? this.smsQueue
          : queueName === "ai"
            ? this.aiQueue
            : this.workflowQueue;
      await (queue as unknown).clean(0, 1000);
      logger.info(`[BullMQ] Queue ${queueName} flushed`);
    } catch (error: unknown) {
      logger.error(`[BullMQ] Error flushing queue ${queueName}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/**
 * Instance singleton du service BullMQ avancé
 */
export const advancedBullMQService = new AdvancedBullMQService();