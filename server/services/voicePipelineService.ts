import { AI_MODEL } from '../_core/aiModels';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from "../infrastructure/logger";
import { ASRStreamingService, TranscriptionResult } from './asrStreamingService';
import { invokeLLM, withTimeout, LLM_TIMEOUT_FALLBACK, Message, InvokeResult } from '../_core/llm';
import { synthesizeSpeech } from './ttsService';
import { detectSimpleIntent } from './intentClassifier';
import { getFillerByDuration } from './fillerService';
import * as fs from "fs";
import * as path from "path";

// ============================================================
// ✅ CORRECTION CRITIQUE — Logging des timeouts vocaux
// ============================================================
function logVoiceTimeout(callId: string, context?: Record<string, unknown>): void {
  const entry = {
    level: "AI_TIMEOUT",
    service: "voicePipeline",
    callId,
    timestamp: Date.now(),
    ...context,
  };
  logger.error("AI_TIMEOUT", entry);
  try {
    const logsDir = path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "ai-errors.log"),
      JSON.stringify(entry) + "\n",
      "utf8"
    );
  } catch (_) {
    // Logging must never crash the application
  }
}

// ============================================================
// ✅ NOUVEAU — Charge le systemPrompt depuis la DB (ai_roles)
//    Prend le premier rôle actif du tenant, sinon prompt par défaut.
// ============================================================
async function loadSystemPromptForTenant(tenantId: number): Promise<string> {
  const DEFAULT_PROMPT = `Tu es un assistant vocal intelligent pour Servicall CRM.
Ton rôle est d'aider les clients de manière courtoise et efficace.
Réponds toujours en français. Sois concis et précis.

RÈGLES IMPORTANTES :
- Si tu ne disposes pas de l'information demandée, dis-le clairement et propose un transfert vers un conseiller ou un rappel.
- Si l'appelant demande à parler à un humain, réponds : "Je vous comprends, je vais vous mettre en relation avec un conseiller."
- Ne fais jamais de promesses sur des prix ou des délais sans validation.
- Reste toujours courtois même face à un appelant mécontent.`;

  try {
    const { getDbInstance } = await import("../db");
    const { aiRoles } = await import("../../drizzle/schema-ai");
    const { eq, and } = await import("drizzle-orm");

    const db = getDbInstance();
    if (!db) return DEFAULT_PROMPT;

    const roles = await db
      .select()
      .from(aiRoles)
      .where(and(eq(aiRoles.tenantId, tenantId), eq(aiRoles.isActive, true)))
      .limit(1);

    if (roles.length > 0 && roles[0].prompt) {
      logger.info("[VoicePipeline] Loaded system prompt from DB", {
        tenantId,
        roleId: roles[0].id,
        roleName: roles[0].name,
      });
      return roles[0].prompt;
    }

    logger.info("[VoicePipeline] No active AI role found, using default prompt", { tenantId });
    return DEFAULT_PROMPT;
  } catch (err: unknown) {
    logger.warn("[VoicePipeline] Failed to load system prompt from DB, using default", { err });
    return DEFAULT_PROMPT;
  }
}

// ============================================================
// ✅ NOUVEAU — Détecte si l'IA doit déclencher un transfert
//    Retourne le type de déclencheur ou null si pas de transfert
// ============================================================
type TransferTrigger = "no_info" | "caller_request" | "sentiment_low" | null;

function detectTransferTrigger(
  userText: string,
  aiResponse: string
): TransferTrigger {
  const userLower = userText.toLowerCase();
  const aiLower = aiResponse.toLowerCase();

  // L'appelant demande explicitement un humain
  const humanRequestPatterns = [
    "parler à un humain", "parler à quelqu'un", "un conseiller",
    "un agent", "un opérateur", "je veux parler à", "transférez-moi",
    "mettez-moi en relation", "appelez quelqu'un", "vraie personne",
    "pas un robot", "pas une ia", "un vrai", "responsable",
  ];
  if (humanRequestPatterns.some((p) => userLower.includes(p))) {
    return "caller_request";
  }

  // L'IA signale qu'elle n'a pas l'info (patterns générés par le LLM)
  const noInfoPatterns = [
    "je ne dispose pas", "je n'ai pas cette information",
    "je ne peux pas répondre", "cette information n'est pas disponible",
    "je vous recommande de contacter", "je vais vous transférer",
    "je ne suis pas en mesure", "cette question dépasse",
    "pour cette demande spécifique", "je n'ai pas accès",
  ];
  if (noInfoPatterns.some((p) => aiLower.includes(p))) {
    return "no_info";
  }

  return null;
}

export interface PipelineConfig {
  callId: string;
  streamSid: string;
  callSid: string;
  tenantId?: number;
  prospectPhone?: string;
  prospectName?: string;
  prospectId?: number;
  systemPrompt?: string;
  asrProvider?: 'openai' | 'deepgram' | 'assemblyai';
  llmModel?: string;
  ttsVoice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  enableSentimentAnalysis?: boolean;
  enableVoiceCloning?: boolean;
  voiceCloneId?: string;
}

export class VoicePipelineService extends EventEmitter {
  private config: PipelineConfig;
  private asrService!: ASRStreamingService;
  private conversationHistory: Array<Message> = [];
  private isProcessing: boolean = false;
  private ws: WebSocket;
  private lastBargeInTime: number = 0;
  private isSpeaking: boolean = false;
  // ✅ NOUVEAU — Suivi du contexte de transfert
  private transferTriggered: boolean = false;
  private conversationTranscript: string[] = [];

  constructor(ws: WebSocket, config: PipelineConfig) {
    super();
    this.ws = ws;
    this.config = {
      // Prompt par défaut — sera remplacé par loadSystemPromptForTenant()
      systemPrompt: `Tu es un assistant vocal intelligent pour Servicall CRM.
Réponds toujours en français. Sois concis.`,
      asrProvider: 'deepgram',
      llmModel: AI_MODEL.DEFAULT,
      ttsVoice: 'alloy',
      ...config,
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    this.asrService = new ASRStreamingService(this.config.callId, {
      provider: this.config.asrProvider!,
      language: 'fr',
      interimResults: true,
    });

    this.asrService.on('transcription', (result: TranscriptionResult) => {
      this.handleTranscription(result);
    });

    this.asrService.on('barge_in_detected', (data: { text: string }) => {
      this.handleBargeIn(data.text);
    });

    // Le systemPrompt sera injecté dans start() après chargement DB
    this.conversationHistory = [
      { role: 'system', content: this.config.systemPrompt! },
    ];
  }

  /**
   * Intelligent Barge-in Handler
   */
  private handleBargeIn(text: string): void {
    const now = Date.now();
    if (now - this.lastBargeInTime < 500) return;
    if (text.trim().length < 3) return;

    if (this.isSpeaking) {
      logger.info('[Voice Pipeline] Intelligent Barge-in detected', {
        callId: this.config.callId,
        text
      });
      this.lastBargeInTime = now;
      this.isSpeaking = false;
      this.ws.send(JSON.stringify({
        event: 'clear',
        streamSid: this.config.streamSid,
      }));
    }
  }

  /**
   * ✅ NOUVEAU — start() charge le systemPrompt depuis la DB avant de démarrer
   */
  async start(): Promise<void> {
    // 1. Charger le systemPrompt depuis la DB (rôle IA configuré dans l'interface)
    if (this.config.tenantId) {
      const dbPrompt = await loadSystemPromptForTenant(this.config.tenantId);
      // Si un prompt était déjà passé en config, on le préfixe au prompt DB
      const finalPrompt = this.config.systemPrompt
        ? `${dbPrompt}\n\n${this.config.systemPrompt}`
        : dbPrompt;

      this.config.systemPrompt = finalPrompt;
      // Mettre à jour l'historique de conversation avec le bon prompt
      this.conversationHistory = [{ role: 'system', content: finalPrompt }];
    }

    // 2. Message d'accueil
    const greeting = "Bonjour, je suis l'assistant intelligent de Servicall. Comment puis-je vous aider ?";
    await this.sendAIResponse(greeting);
  }

  async processAudio(audioChunk: string): Promise<void> {
    await this.asrService.processAudioChunk(audioChunk);
  }

  private async handleTranscription(result: TranscriptionResult): Promise<void> {
    if (!result.isFinal || result.text.trim().length === 0) return;
    if (this.isProcessing) return;

    // Bloquer tout nouveau traitement si transfert déjà déclenché
    if (this.transferTriggered) return;

    this.isProcessing = true;

    try {
      // Enregistrer dans le transcript
      this.conversationTranscript.push(`Appelant: ${result.text}`);
      this.conversationHistory.push({ role: 'user', content: result.text });

      // 1. Quick NLU
      const simpleIntent = detectSimpleIntent(result.text);
      if (simpleIntent) {
        // Handle simple intents — pass through to LLM anyway for context
      }

      // 2. Filler immédiat pour réduire la latence perçue
      const filler = getFillerByDuration(1500);
      if (filler) {
        await this.sendAIResponse(filler, true);
      }

      // 3. LLM avec timeout
      const llmResponse = await this.processLLM();
      const responseText = typeof llmResponse.content === 'string'
        ? llmResponse.content
        : LLM_TIMEOUT_FALLBACK;

      // Enregistrer la réponse IA dans le transcript
      this.conversationTranscript.push(`Assistant: ${responseText}`);

      // 4. ✅ NOUVEAU — Détecter si transfert nécessaire
      if (!this.transferTriggered) {
        const trigger = detectTransferTrigger(result.text, responseText);
        if (trigger) {
          this.transferTriggered = true;
          // Envoyer la réponse IA d'abord (annonce du transfert)
          await this.sendAIResponse(responseText);
          // Déclencher le transfert intelligent
          await this.triggerSmartTransfer(trigger);
          return;
        }
      }

      if (llmResponse.tool_call_id || (llmResponse as unknown).tool_calls) {
        await this.handleToolCalls(llmResponse);
      } else {
        await this.sendAIResponse(responseText);
      }

    } catch (error: unknown) {
      logger.error('[Voice Pipeline] Error processing transcription', {
        error: error instanceof Error ? error.message : String(error),
        callId: this.config.callId,
      });
      await this.sendAIResponse(LLM_TIMEOUT_FALLBACK);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processLLM(): Promise<Message> {
    const tenantId = this.config.tenantId || 1;
    
    try {
      const result = await withTimeout(
        invokeLLM(tenantId, {
          model: this.config.llmModel!,
          messages: this.conversationHistory,
          temperature: 0.7,
          maxTokens: 150,
        }),
        8000 // 8s timeout for voice pipeline
      ) as InvokeResult;

      const message = result.choices[0]?.message;
      if (!message) throw new Error("No message returned from LLM");
      
      this.conversationHistory.push(message);
      return message;

    } catch (error: unknown) {
      logVoiceTimeout(this.config.callId, { 
        tenantId, 
        historyLength: this.conversationHistory.length 
      });
      return { role: 'assistant', content: LLM_TIMEOUT_FALLBACK };
    }
  }

  private async sendAIResponse(text: string, isFiller: boolean = false): Promise<void> {
    if (!text || text === LLM_TIMEOUT_FALLBACK) return;
    
    try {
      this.isSpeaking = !isFiller;
      const audioBase64 = await synthesizeSpeech(text, {
        voice: this.config.ttsVoice!,
      });

      this.ws.send(JSON.stringify({
        event: 'media',
        streamSid: this.config.streamSid,
        media: { payload: audioBase64 },
      }));

    } catch (error: unknown) {
      logger.error('[Voice Pipeline] TTS error', { error, callId: this.config.callId });
    }
  }

  private async handleToolCalls(message: Message): Promise<void> {
    // Tool calling logic would go here
    // For now, just send the content if available
    if (message.content && typeof message.content === 'string') {
      await this.sendAIResponse(message.content);
    }
  }

  /**
   * Déclenche le transfert intelligent via SmartTransferService
   */
  private async triggerSmartTransfer(trigger: "no_info" | "caller_request" | "sentiment_low"): Promise<void> {
    try {
      const { resolveTransfer } = await import("./smartTransferService");
      
      logger.info("[VoicePipeline] Triggering smart transfer", {
        callId: this.config.callId,
        trigger,
      });

      const decision = await resolveTransfer({
        tenantId: this.config.tenantId || 1,
        callSid: this.config.callSid,
        prospectPhone: this.config.prospectPhone || "Inconnu",
        prospectName: this.config.prospectName,
        prospectId: this.config.prospectId,
        trigger,
        conversationSummary: this.conversationTranscript.join("\n"),
      });

      // Notifier le frontend ou Twilio de la décision
      this.emit("transfer_decision", decision);

    } catch (err: unknown) {
      logger.error("[VoicePipeline] Smart transfer failed", { err, callId: this.config.callId });
    }
  }

  stop(): void {
    this.asrService.stop();
    this.removeAllListeners();
  }
}
