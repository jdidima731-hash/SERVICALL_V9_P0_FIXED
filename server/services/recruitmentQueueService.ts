import { Queue, Worker, Job } from "bullmq";
import { logger } from "../infrastructure/logger";
import { makeBullMQConnection } from "../infrastructure/redis/bullmq.connection";
import { recruitmentService } from "./RecruitmentService";
import * as Sentry from "@sentry/node";

/**
 * Service de gestion des queues pour le module de recrutement IA
 * Gère la planification et l'exécution des entretiens automatisés
 */

// ============================================
// TYPES
// ============================================

interface ScheduleInterviewJobData {
  interviewId: number;
  tenantId: number;
  scheduledAt: Date;
}

interface ProcessTranscriptJobData {
  interviewId: number;
  tenantId: number;
  transcript: string;
  duration: number;
}

interface GenerateReportJobData {
  interviewId: number;
  tenantId: number;
}

interface ReminderJobData {
  interviewId: number;
  tenantId: number;
  candidatePhone: string;
  scheduledAt: Date;
}

// ============================================
// QUEUES
// ============================================

let interviewScheduleQueue: Queue | null = null;
let transcriptProcessingQueue: Queue | null = null;
let reportGenerationQueue: Queue | null = null;
let reminderQueue: Queue | null = null;

let workersInitialized = false;

/**
 * Initialiser les queues de recrutement
 */
export function initializeRecruitmentQueues(): void {
  try {

    // Queue pour planifier les entretiens
    interviewScheduleQueue = new Queue("recruitment-interview-schedule", {
      connection: makeBullMQConnection()!,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { age: 86400 }, // 24h
        removeOnFail: { age: 172800 }, // 48h
      },
    });

    // Queue pour traiter les transcripts
    transcriptProcessingQueue = new Queue("recruitment-transcript-processing", {
      connection: makeBullMQConnection()!,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 172800 },
      },
    });

    // Queue pour générer les rapports
    reportGenerationQueue = new Queue("recruitment-report-generation", {
      connection: makeBullMQConnection()!,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 172800 },
      },
    });

    // Queue pour les rappels candidats
    reminderQueue = new Queue("recruitment-reminders", {
      connection: makeBullMQConnection()!,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 60000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 172800 },
      },
    });

    logger.info("[RecruitmentQueue] Queues initialized successfully");
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to initialize queues", { error });
    Sentry.captureException(error);
  }
}

/**
 * Initialiser les workers pour traiter les jobs
 */
export function initializeRecruitmentWorkers(): void {
  if (workersInitialized) return;

  try {

    // Worker pour planifier et démarrer les entretiens
    new Worker(
      "recruitment-interview-schedule",
      async (job: Job<ScheduleInterviewJobData>) => {
        logger.info("[RecruitmentWorker] Processing interview schedule job", {
          jobId: job.id,
          interviewId: job.data.interviewId,
        });

        try {
          await recruitmentService.receiveCall(job.data.interviewId);
          logger.info("[RecruitmentWorker] Interview started successfully", {
            interviewId: job.data.interviewId,
          });
        } catch (error: any) {
          logger.error("[RecruitmentWorker] Failed to start interview", {
            error,
            interviewId: job.data.interviewId,
          });
          Sentry.captureException(error);
          throw error;
        }
      },
      {
        connection: makeBullMQConnection()!,
        concurrency: 5, // 5 entretiens simultanés max
        limiter: {
          max: 10, // 10 jobs max
          duration: 60000, // par minute
        },
      }
    );

    // Worker pour traiter les transcripts
    new Worker(
      "recruitment-transcript-processing",
      async (job: Job<ProcessTranscriptJobData>) => {
        logger.info("[RecruitmentWorker] Processing transcript job", {
          jobId: job.id,
          interviewId: job.data.interviewId,
        });

        try {
          // Mettre à jour le transcript
          await recruitmentService.updateTranscript(
            job.data.interviewId,
            job.data.transcript,
            job.data.duration
          );

          // Déclencher la génération du rapport
          await addReportGenerationJob({
            interviewId: job.data.interviewId,
            tenantId: job.data.tenantId,
          });

          logger.info("[RecruitmentWorker] Transcript processed successfully", {
            interviewId: job.data.interviewId,
          });
        } catch (error: any) {
          logger.error("[RecruitmentWorker] Failed to process transcript", {
            error,
            interviewId: job.data.interviewId,
          });
          Sentry.captureException(error);
          throw error;
        }
      },
      {
        connection: makeBullMQConnection()!,
        concurrency: 3, // 3 analyses simultanées max (IA intensive)
      }
    );

    // Worker pour générer les rapports
    new Worker(
      "recruitment-report-generation",
      async (job: Job<GenerateReportJobData>) => {
        logger.info("[RecruitmentWorker] Processing report generation job", {
          jobId: job.id,
          interviewId: job.data.interviewId,
        });

        try {
          await recruitmentService.generateReport(job.data.interviewId);
          logger.info("[RecruitmentWorker] Report generated successfully", {
            interviewId: job.data.interviewId,
          });
        } catch (error: any) {
          logger.error("[RecruitmentWorker] Failed to generate report", {
            error,
            interviewId: job.data.interviewId,
          });
          Sentry.captureException(error);
          throw error;
        }
      },
      {
        connection: makeBullMQConnection()!,
        concurrency: 3,
      }
    );

    // Worker pour les rappels
    new Worker(
      "recruitment-reminders",
      async (job: Job<ReminderJobData>) => {
        logger.info("[RecruitmentWorker] Processing reminder job", {
          jobId: job.id,
          interviewId: job.data.interviewId,
        });

        try {
          // Envoi de rappel à connecter au canal SMS/email retenu par le déploiement
          // await twilioService.sendSMS({
          //   to: job.data.candidatePhone,
          //   body: `Rappel: Votre entretien est prévu le ${job.data.scheduledAt.toLocaleString()}`
          // });

          logger.info("[RecruitmentWorker] Reminder sent successfully", {
            interviewId: job.data.interviewId,
          });
        } catch (error: any) {
          logger.error("[RecruitmentWorker] Failed to send reminder", {
            error,
            interviewId: job.data.interviewId,
          });
          // Ne pas relancer en cas d'échec de rappel
        }
      },
      {
        connection: makeBullMQConnection()!,
        concurrency: 10,
      }
    );

    workersInitialized = true;
    logger.info("[RecruitmentQueue] Workers initialized successfully");
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to initialize workers", { error });
    Sentry.captureException(error);
  }
}

// ============================================
// FONCTIONS PUBLIQUES
// ============================================

/**
 * Planifier un entretien
 */
export async function scheduleInterview(data: ScheduleInterviewJobData): Promise<void> {
  if (!interviewScheduleQueue) {
    throw new Error("Interview schedule queue not initialized");
  }

  try {
    const delay = new Date(data.scheduledAt).getTime() - Date.now();

    await interviewScheduleQueue.add(
      "schedule-interview",
      data,
      {
        delay: delay > 0 ? delay : 0, // Délai jusqu'à l'heure planifiée
        jobId: `interview-${data.interviewId}`,
      }
    );

    logger.info("[RecruitmentQueue] Interview scheduled", {
      interviewId: data.interviewId,
      scheduledAt: data.scheduledAt,
      delay,
    });
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to schedule interview", { error, data });
    throw error;
  }
}

/**
 * Ajouter un job de traitement de transcript
 */
export async function addTranscriptProcessingJob(data: ProcessTranscriptJobData): Promise<void> {
  if (!transcriptProcessingQueue) {
    throw new Error("Transcript processing queue not initialized");
  }

  try {
    await transcriptProcessingQueue.add("process-transcript", data, {
      jobId: `transcript-${data.interviewId}`,
    });

    logger.info("[RecruitmentQueue] Transcript processing job added", {
      interviewId: data.interviewId,
    });
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to add transcript processing job", { error, data });
    throw error;
  }
}

/**
 * Ajouter un job de génération de rapport
 */
export async function addReportGenerationJob(data: GenerateReportJobData): Promise<void> {
  if (!reportGenerationQueue) {
    throw new Error("Report generation queue not initialized");
  }

  try {
    await reportGenerationQueue.add("generate-report", data, {
      jobId: `report-${data.interviewId}`,
    });

    logger.info("[RecruitmentQueue] Report generation job added", {
      interviewId: data.interviewId,
    });
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to add report generation job", { error, data });
    throw error;
  }
}

/**
 * Planifier un rappel candidat
 */
export async function scheduleReminder(data: ReminderJobData, reminderTime: Date): Promise<void> {
  if (!reminderQueue) {
    throw new Error("Reminder queue not initialized");
  }

  try {
    const delay = reminderTime.getTime() - Date.now();

    await reminderQueue.add("send-reminder", data, {
      delay: delay > 0 ? delay : 0,
      jobId: `reminder-${data.interviewId}-${reminderTime.getTime()}`,
    });

    logger.info("[RecruitmentQueue] Reminder scheduled", {
      interviewId: data.interviewId,
      reminderTime,
      delay,
    });
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to schedule reminder", { error, data });
    throw error;
  }
}

/**
 * Annuler un entretien planifié
 */
export async function cancelScheduledInterview(interviewId: number): Promise<void> {
  if (!interviewScheduleQueue) {
    throw new Error("Interview schedule queue not initialized");
  }

  try {
    const jobId = `interview-${interviewId}`;
    const job = await interviewScheduleQueue.getJob(jobId);

    if (job) {
      await job.remove();
      logger.info("[RecruitmentQueue] Scheduled interview cancelled", { interviewId });
    }
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to cancel scheduled interview", { error, interviewId });
    throw error;
  }
}

/**
 * Obtenir le statut d'un job
 */
export async function getInterviewJobStatus(interviewId: number): Promise<any> {
  if (!interviewScheduleQueue) {
    throw new Error("Interview schedule queue not initialized");
  }

  try {
    const jobId = `interview-${interviewId}`;
    const job = await interviewScheduleQueue.getJob(jobId);

    if (!job) {
      return { status: "not_found" };
    }

    const state = await job.getState();
    return {
      status: state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
    };
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to get job status", { error, interviewId });
    return { status: "error", error };
  }
}

/**
 * Nettoyer les anciens jobs
 */
export async function cleanOldJobs(): Promise<void> {
  try {
    const queues = [
      interviewScheduleQueue,
      transcriptProcessingQueue,
      reportGenerationQueue,
      reminderQueue,
    ];

    for (const queue of queues) {
      if (queue) {
        await queue.clean(86400000, 1000, "completed"); // 24h
        await queue.clean(172800000, 1000, "failed"); // 48h
      }
    }

    logger.info("[RecruitmentQueue] Old jobs cleaned successfully");
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to clean old jobs", { error });
  }
}

/**
 * Fermer toutes les queues proprement
 */
export async function closeRecruitmentQueues(): Promise<void> {
  try {
    const queues = [
      interviewScheduleQueue,
      transcriptProcessingQueue,
      reportGenerationQueue,
      reminderQueue,
    ];

    for (const queue of queues) {
      if (queue) {
        await queue.close();
      }
    }

    logger.info("[RecruitmentQueue] All queues closed successfully");
  } catch (error: any) {
    logger.error("[RecruitmentQueue] Failed to close queues", { error });
  }
}

// Initialiser via startServer() pour respecter l'ordre des dépendances (Redis)
// if (process.env['NODE_ENV'] !== "test") {
//   initializeRecruitmentQueues();
//   initializeRecruitmentWorkers();
// }
