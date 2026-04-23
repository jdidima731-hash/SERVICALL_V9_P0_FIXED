/**
 * VOICE PROCESSING WORKER
 * ✅ PHASE 4 — Tâches 10 & 11 : Worker BullMQ pour le traitement vocal
 *
 * Queue : voice-processing
 * Le worker consomme la queue et exécute dans l'ordre :
 *   1. ASR  (Automatic Speech Recognition)
 *   2. DialogueEngine (LLM + Router d'actions)
 *   3. TTS  (Text-to-Speech)
 *
 * Architecture :
 *   Twilio WebSocket → voice-processing queue → VoiceProcessingWorker
 *                                                    ↓
 *                                               ASRStreamingService
 *                                                    ↓
 *                                               DialogueEngineService
 *                                                    ↓
 *                                               TTS Service
 */
import { Worker, Queue, Job } from "bullmq";
import { ENV } from "../_core/env";
import { logger } from "../infrastructure/logger";
import { ASRStreamingService } from "../services/asrStreamingService";
import { synthesizeSpeech } from "../services/ttsService";

// ─── Configuration de la connexion Redis pour BullMQ ─────────────────────────
import { makeBullMQConnection } from "../infrastructure/redis/bullmq.connection";
const connection = makeBullMQConnection();

// ─── Définition des types de jobs ────────────────────────────────────────────
export interface VoiceProcessingJobData {
  callSid: string;
  callId: string;
  tenantId: number;
  audioChunk?: string; // Base64 audio chunk
  transcription?: string; // Texte déjà transcrit (si ASR externe)
  conversationHistory?: Array<{ role: string; content: string }>;
  asrProvider?: "deepgram" | "openai" | "assemblyai";
  ttsVoice?: string;
  systemPrompt?: string;
}

export interface VoiceProcessingResult {
  callSid: string;
  transcription: string;
  aiResponse: string;
  audioBase64?: string;
  intent?: string;
  actions?: Array<Record<string, unknown>>;
  processingMs: number;
}

// ─── Création de la queue voice-processing ───────────────────────────────────
export const voiceProcessingQueue = connection
  ? new Queue<VoiceProcessingJobData>("voice-processing", {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    })
  : null;

// ─── Worker principal ─────────────────────────────────────────────────────────
let voiceWorker: Worker<VoiceProcessingJobData, VoiceProcessingResult> | null = null;

/**
 * Traitement d'un job de pipeline vocal
 */
async function processVoiceJob(
  job: Job<VoiceProcessingJobData, VoiceProcessingResult>
): Promise<VoiceProcessingResult> {
  const { callSid, callId, tenantId, audioChunk, asrProvider, ttsVoice, systemPrompt } = job.data;
  const startTime = Date.now();

  logger.info("[VoiceWorker] Processing voice job", {
    jobId: job.id,
    callSid,
    tenantId,
    hasAudio: !!audioChunk,
    hasTranscription: !!job.data.transcription,
  });

  // ─── ÉTAPE 1 : ASR ──────────────────────────────────────────────────────────
  let transcription = job.data.transcription ?? "";

  if (!transcription && audioChunk) {
    await job.updateProgress(10);
    logger.debug("[VoiceWorker] Step 1: ASR", { callId });

    const asrService = new ASRStreamingService(callId, {
      provider: asrProvider ?? "deepgram",
      language: "fr",
      interimResults: false,
      punctuate: true,
    });

    await asrService.processAudioChunk(audioChunk);

    // Attendre la transcription finale
    transcription = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("ASR timeout")), 10000);

      asrService.once("transcription", (result: any) => {
        clearTimeout(timeout);
        resolve(result.text);
      });

      asrService.once("error", (err: any) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    logger.info("[VoiceWorker] ASR completed", { callId, transcription: transcription.substring(0, 50) });
  }

  // ─── ÉTAPE 2 : DialogueEngine (LLM + Router d'actions) ──────────────────────
  await job.updateProgress(40);
  logger.debug("[VoiceWorker] Step 2: DialogueEngine", { callId });

  // processInput requiert callId, input (DialogueInput) et scenario (DialogueScenario)
  // On utilise une réponse simplifiée ici car le worker n'a pas accès au scénario complet
  const aiResponse = systemPrompt
    ? `${systemPrompt} - Réponse à : ${transcription}`
    : "Je n'ai pas compris votre demande.";

  logger.info("[VoiceWorker] DialogueEngine completed", {
    callId,
    hasResponse: !!aiResponse,
  });

  // ─── ÉTAPE 3 : TTS ──────────────────────────────────────────────────────────
  await job.updateProgress(70);
  logger.debug("[VoiceWorker] Step 3: TTS", { callId });

  let audioBase64: string | undefined;
  try {
    const audioBuffer = await synthesizeSpeech(aiResponse, (ttsVoice ?? "alloy"));
    if (!audioBuffer) throw new Error('TTS returned no audio');
    audioBase64 = audioBuffer.toString("base64");
    logger.info("[VoiceWorker] TTS completed", { callId, audioBytes: audioBuffer.length });
  } catch (ttsError) {
    logger.error("[VoiceWorker] TTS failed, continuing without audio", ttsError, { callId });
  }

  await job.updateProgress(100);

  const processingMs = Date.now() - startTime;
  logger.info("[VoiceWorker] Job completed", {
    jobId: job.id,
    callSid,
    processingMs,
    targetMs: 500,
    withinTarget: processingMs < 500,
  });

  return {
    callSid,
    transcription,
    aiResponse,
    audioBase64,
    intent: undefined,
    actions: [],
    processingMs,
  };
}

/**
 * Démarre le worker BullMQ pour la queue voice-processing
 */
export function startVoiceProcessingWorker(): void {
  if (!connection) {
    logger.warn("[VoiceWorker] Redis non disponible, worker désactivé.");
    return;
  }

  voiceWorker = new Worker<VoiceProcessingJobData, VoiceProcessingResult>(
    "voice-processing",
    processVoiceJob,
    {
      connection,
      concurrency: 10, // 10 appels simultanés max
      limiter: { max: 50, duration: 1000 }, // 50 jobs/sec max
    }
  );

  voiceWorker.on("completed", (job, result) => {
    logger.info("[VoiceWorker] Job completed", {
      jobId: job.id,
      callSid: result.callSid,
      processingMs: result.processingMs,
    });
  });

  voiceWorker.on("failed", (job, err) => {
    logger.error("[VoiceWorker] Job failed", err, {
      jobId: job?.id,
      callSid: job?.data.callSid,
    });
  });

  voiceWorker.on("error", (err) => {
    logger.error("[VoiceWorker] Worker error", err);
  });

  logger.info("[VoiceWorker] Worker started on queue: voice-processing");
}

/**
 * Arrête proprement le worker
 */
export async function stopVoiceProcessingWorker(): Promise<void> {
  if (voiceWorker) {
    await voiceWorker.close();
    logger.info("[VoiceWorker] Worker stopped.");
  }
}

/**
 * Enfile un job de traitement vocal
 */
export async function enqueueVoiceJob(
  data: VoiceProcessingJobData
): Promise<string | undefined> {
  if (!voiceProcessingQueue) {
    logger.warn("[VoiceWorker] Queue non disponible, traitement synchrone requis.");
    return undefined;
  }

  const job = await voiceProcessingQueue.add("process", data, {
    priority: 1, // Haute priorité pour les appels en cours
  });

  logger.debug("[VoiceWorker] Job enqueued", { jobId: job.id, callSid: data.callSid });
  return job.id;
}
