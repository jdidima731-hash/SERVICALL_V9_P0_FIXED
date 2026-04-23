/**
 * REALTIME VOICE PIPELINE
 * ✅ PHASE 8 — Tâche 22 : Pipeline vocal temps réel complet
 *
 * Architecture :
 *   Twilio WebSocket (mulaw 8kHz)
 *     → ASRStreamingService (Deepgram ou Whisper avec failover)
 *     → LLM Streaming (token par token)
 *     → TTS (OpenAI TTS)
 *     → Twilio WebSocket (mulaw 8kHz)
 *
 * Latence cible : <500 ms pour le premier token TTS
 *
 * Fonctionnalités :
 *   - Détection de fin de parole (VAD simplifié)
 *   - Interruption de la réponse IA si l'utilisateur parle
 *   - Historique de conversation en Redis (TTL 1h)
 *   - Monitoring temps réel via RealtimeWorkflowMonitor
 *   - Protection anti-injection de prompts
 */
import WebSocket from "ws";
import { EventEmitter } from 'events';
import { ASRStreamingService, type TranscriptionResult } from "./asrStreamingService";
import { streamToVoice } from "./llmStreamingService";
import { synthesizeSpeech } from "./ttsService";
import { RealtimeWorkflowMonitor } from "./realtimeWorkflowMonitor";
import { promptSecurityGuard } from "./promptSecurityService";
import { recordOpenAIUsage } from "./openaiUsageMonitor";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { logger } from "../infrastructure/logger";
import { AI_MODEL } from "../_core/aiModels";
import { DialogueEngineService } from "./DialogueEngineService";
import type { DialogueOutput } from "./DialogueEngineService";
import { RealtimeAgentCoachingService } from "./realtimeAgentCoachingService";
import { DialogueScenario } from "../../shared/types/dialogue";
import { DialogueScenarioRepository } from "./DialogueScenarioRepository";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VoicePipelineConfig {
  callSid: string;
  streamSid?: string;
  callId: number;
  tenantId: number;
  systemPrompt: string;
  language?: string;
  asrProvider?: "deepgram" | "openai" | "assemblyai";
  ttsVoice?: string;
  maxTurns?: number;
  prospectId?: number;
  scenarioId?: string;
  agentId?: number;
}

interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TwilioMediaMessage {
  event: string;
  media?: { payload: string; track?: string };
  start?: { callSid: string; streamSid: string };
  stop?: Record<string, unknown>;
}

const CONVERSATION_TTL = 3600; // 1 heure
const MAX_HISTORY_TURNS = 20;

// ─── Classe principale ────────────────────────────────────────────────────────
export class RealtimeVoicePipeline {
  private config: VoicePipelineConfig;
  private asr: ASRStreamingService;
  private ws: WebSocket;
  private streamSid: string = "";
  private isResponding: boolean = false;
  private isStopped: boolean = false;
  private conversationKey: string;
  private dialogueEngineService: DialogueEngineService;
  private realtimeAgentCoachingService: RealtimeAgentCoachingService | undefined;
  private cachedScenario: DialogueScenario | null = null; // ✅ scénario chargé depuis DB

  constructor(ws: WebSocket, config: VoicePipelineConfig) {
    this.ws = ws;
    this.config = {
      language: "fr",
      asrProvider: "deepgram",
      ttsVoice: "alloy",
      maxTurns: MAX_HISTORY_TURNS,
      ...config,
    };

    this.conversationKey = `conversation:${config.callSid}`;
    this.dialogueEngineService = new DialogueEngineService();

    if (this.config.agentId) {
      this.realtimeAgentCoachingService = new RealtimeAgentCoachingService({
        callSid: this.config.callSid,
        tenantId: this.config.tenantId,
        agentId: this.config.agentId,
        ws: this.ws,
      });
    }

    this.asr = new ASRStreamingService(String(config.callId), {
      provider: this.config.asrProvider ?? "deepgram",
      language: this.config.language ?? "fr",
      interimResults: false,
      punctuate: true,
    });

    this.setupASRListeners();
    this.setupWebSocketListeners();
  }

  /**
   * Démarre le pipeline et initialise la session Redis
   */
  async start(): Promise<void> {    // Initialiser le DialogueEngineService avec le scénario et le prospect
    if (!this.config.scenarioId || !this.config.prospectId) {
      logger.error("[VoicePipeline] Missing scenarioId or prospectId for DialogueEngine initialization", { callSid: this.config.callSid });
      throw new Error("Missing scenarioId or prospectId");
    }

    // ✅ CORRECTION: Chargement du scénario depuis la DB (workflows) ou templates industrie
    // Priorité : Redis cache → DB workflows → templates → générique
    const scenario: DialogueScenario = await DialogueScenarioRepository.findById(
      this.config.scenarioId,
      this.config.tenantId,
      this.config.systemPrompt
    );
    this.cachedScenario = scenario; // stocké pour handleUserTurn
    logger.info("[VoicePipeline] Scenario loaded", {
      callSid: this.config.callSid,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      statesCount: scenario.states.length,
    });

    await this.dialogueEngineService.initializeConversation(
      this.config.callSid,
      scenario,
      this.config.tenantId,
      this.config.prospectId,
      
      String(this.config.callId)
    );
    // L\'historique de conversation sera géré par DialogueEngineService

    // Démarrer le monitoring
    await RealtimeWorkflowMonitor.startCall({
      callId: parseInt(String(this.config.callId), 10),
      callSid: this.config.callSid,
      tenantId: this.config.tenantId,
      direction: "inbound",
      from: "unknown",
      to: "unknown",
    });

    logger.info("[VoicePipeline] Pipeline started", {
      callSid: this.config.callSid,
      tenantId: this.config.tenantId,
      asrProvider: this.config.asrProvider,
    });
  }

  /**
   * Arrête proprement le pipeline
   */
  async stop(reason: "completed" | "failed" | "timeout" = "completed"): Promise<void> {
    if (this.isStopped) return;
    this.isStopped = true;

    await this.asr.stop();
    await RealtimeWorkflowMonitor.endCall(this.config.callSid, reason);

    logger.info("[VoicePipeline] Pipeline stopped", {
      callSid: this.config.callSid,
      reason,
    });
  }

 // ─── Listeners ASR ────────────────────────────────────────────────────────
  private setupASRListeners(): void {
    // ✅ Barge-in plus réactif : Interrompre dès qu'une parole est détectée
    this.asr.on("barge_in_detected", async (data: { text: string }) => {
      if (this.isResponding) {
        logger.info("[VoicePipeline] Barge-in detected, stopping AI response", {
          callSid: this.config.callSid,
          text: data.text,
        });
        this.isResponding = false;
        // Optionnel : Envoyer un signal d'interruption à Twilio si nécessaire (Clear buffer)
        this.ws.send(JSON.stringify({ event: "clear", streamSid: this.streamSid }));
      }
    });

    this.asr.on("transcription", async (result: TranscriptionResult) => {
      if (!result.isFinal || result.text.trim().length === 0) return;

      logger.info("[VoicePipeline] Transcription received", {
        callSid: this.config.callSid,
        text: result.text.substring(0, 100),
        confidence: result.confidence,
      });

      await this.handleUserTurn(result.text);
    });

    this.asr.on("error", (err: Error) => {
      logger.error("[VoicePipeline] ASR error", err, { callSid: this.config.callSid });
    });

    this.asr.on("fatal_error", async (err: Error) => {
      logger.error("[VoicePipeline] ASR fatal error, stopping pipeline", err, {
        callSid: this.config.callSid,
      });
      await this.stop("failed");
    });
  }

  // ─── Listeners WebSocket ──────────────────────────────────────────────────
  public async processIncomingAudio(payload: string): Promise<void> {
    await this.asr.processAudioChunk(payload);
  }

  private setupWebSocketListeners(): void {
    this.ws.on("message", async (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as TwilioMediaMessage;

        switch (msg.event) {
          case "start":
            this.streamSid = msg.start?.streamSid ?? "";
            logger.info("[VoicePipeline] Stream started", {
              callSid: this.config.callSid,
              streamSid: this.streamSid,
            });
            break;

          case "media":
            if (msg.media?.payload) {
              await this.asr.processAudioChunk(msg.media.payload);
            }
            break;

          case "stop":
            await this.stop("completed");
            break;
        }
      } catch (err: any) {
        logger.error("[VoicePipeline] WebSocket message error", err, {
          callSid: this.config.callSid,
        });
      }
    });

    this.ws.on("close", async () => {
      await this.stop("completed");
    });

    this.ws.on("error", async (err: Error) => {
      logger.error("[VoicePipeline] WebSocket error", err, { callSid: this.config.callSid });
      await this.stop("failed");
    });
  }

  // ─── Traitement d'un tour utilisateur ────────────────────────────────────
  private async handleUserTurn(userText: string): Promise<void> {
    if (this.isStopped) return;

    const startTime = Date.now();

    // 1. Protection anti-injection de prompts
    const security = (promptSecurityGuard as unknown)(userText, this.config.tenantId);
    if (!security.allowed) {
      logger.warn("[VoicePipeline] Prompt injection blocked", {
        callSid: this.config.callSid,
        reason: security.reason,
      });
      await this.speakResponse("Je suis désolé, je ne peux pas traiter cette demande.");
      return;
    }

    await RealtimeWorkflowMonitor.updateCurrentAction(this.config.callSid, "dialogue_engine_processing");

    this.isResponding = true;
    let dialogueOutput: DialogueOutput;

    try {
      // ✅ CORRECTION: utilise le scénario chargé depuis la DB au démarrage du pipeline
      const scenario = this.cachedScenario ?? await DialogueScenarioRepository.findById(
        this.config.scenarioId!,
        this.config.tenantId,
        this.config.systemPrompt
      );

      dialogueOutput = await this.dialogueEngineService.processInput(
        this.config.callSid,
        {
          text: security.sanitized,
          tenantId: this.config.tenantId,
          prospectId: this.config.prospectId!,
          callId: String(this.config.callId),
        },
        scenario
      );

      const aiResponse = dialogueOutput.response;
      const latencyMs = Date.now() - startTime;

      // Enregistrer l'usage (à adapter si DialogueEngineService gère son propre usage)
      await recordOpenAIUsage({
        tenantId: this.config.tenantId,
        model: AI_MODEL.DEFAULT,
        inputTokens: Math.ceil(security.sanitized.length / 4), // Estimation simple
        outputTokens: Math.ceil(aiResponse.length / 4),
        latencyMs,
      });

      await RealtimeWorkflowMonitor.recordActionSuccess(
        this.config.callSid,
        "dialogue_engine_processing",
        latencyMs
      );

      logger.info("[VoicePipeline] Dialogue Engine Turn completed", {
        callSid: this.config.callSid,
        latencyMs,
        responseLength: aiResponse.length,
        nextState: dialogueOutput.nextState,
      });

      if (aiResponse.trim()) {
        await this.speakResponse(aiResponse);
      }

      // Appeler le service de coaching en temps réel si activé
      if (this.realtimeAgentCoachingService && dialogueOutput.context) {
        await this.realtimeAgentCoachingService.processConversationTurn(
          userText,
          aiResponse,
          dialogueOutput.context
        );
      }

    } catch (err: any) {
      logger.error("[VoicePipeline] Dialogue Engine error", err, { callSid: this.config.callSid });
      await RealtimeWorkflowMonitor.recordActionFailure(
        this.config.callSid,
        "dialogue_engine_processing",
        err instanceof Error ? err.message : String(err)
      );
      await this.speakResponse("Je suis désolé, une erreur s'est produite dans le traitement de votre demande. Veuillez réessayer.");
    } finally {
      this.isResponding = false;
    }
  }

  // ─── Synthèse vocale et envoi à Twilio ───────────────────────────────────
  private async sendAudioToTwilio(text: string): Promise<void> {
    if (!this.streamSid || this.isStopped) return;

    try {
      const audioBuffer = await synthesizeSpeech(text, (this.config.ttsVoice ?? "alloy") as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer');
      if (!audioBuffer) return;
      const audioBase64 = audioBuffer.toString("base64");

      const message = JSON.stringify({
        event: "media",
        streamSid: this.streamSid,
        media: { payload: audioBase64 },
      });

      if (this.ws.readyState === 1 /* OPEN */) {
        this.ws.send(message);
      }
    } catch (err: any) {
      logger.error("[VoicePipeline] TTS error", err, { callSid: this.config.callSid });
    }
  }

  private async speakResponse(text: string): Promise<void> {
    this.isResponding = true;
    await this.sendAudioToTwilio(text);
    this.isResponding = false;
  }
}

/**
 * Factory pour créer et démarrer un pipeline vocal
 */
export async function createVoicePipeline(
  ws: WebSocket,
  config: VoicePipelineConfig
): Promise<RealtimeVoicePipeline> {
  const pipeline = new RealtimeVoicePipeline(ws, config);
  await pipeline.start();
  return pipeline;
}