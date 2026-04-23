import { invokeLLM, withTimeout, LLM_TIMEOUT_FALLBACK } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { logger } from "../infrastructure/logger";
import { ResilienceService } from "./resilienceService";
declare function setImmediate(callback: (...args: any[]) => void): NodeJS.Immediate;
import { AI_MODEL } from "../_core/aiModels";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// ✅ CORRECTION CRITIQUE — Logging des timeouts IA
// ============================================================
function logAITimeout(service: string, context?: Record<string, unknown>): void {
  const entry = {
    level: "AI_TIMEOUT",
    service,
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

export interface CallerQualification {
  prospectName: string;
  prospectEmail?: string;
  prospectPhone: string;
  prospectCompany?: string;
  callReason: string;
  urgency: "low" | "medium" | "high";
  shouldTransferToAgent: boolean;
  recommendedDepartment?: string;
  notes: string;
}

export interface BusinessInsights {
  objections: string[];
  intentions: string[];
  keywords: string[];
  summary: string;
  recommendations: string[];
  sentiment: "positive" | "neutral" | "negative";
  qualityScore: number;
}

/**
 * Qualify a caller based on their speech
 * ✅ AXE 1: Circuit Breaker + Timeout (withTimeout) + Fallback activé
 */
export async function qualifyCallerFromTranscription(
  transcription: string,
  callerPhone: string,
  tenantContext?: {
    tenantId: number;
    tenantName: string;
    businessType: string;
    departments: string[];
  }
): Promise<CallerQualification> {
  const tenantId = tenantContext?.tenantId;

  // ✅ Fallback activé (décommenté) — retour gracieux si IA indisponible
  const fallback = async (): Promise<CallerQualification> => {
    logger.warn("[AI Service] Using fallback for caller qualification", { tenantId });
    return {
      prospectName: "Prospect inconnu",
      prospectPhone: callerPhone,
      callReason: "Qualification en attente (IA indisponible)",
      urgency: "medium",
      shouldTransferToAgent: true,
      notes: "Dégradation fonctionnelle : qualification manuelle requise.",
    };
  };

  const execution = async (): Promise<CallerQualification> => {
    try {
      return await withTimeout(
        (async () => {
          const systemPrompt = `Tu es un assistant de qualification d'appels pour une entreprise de service client.
Analyse la transcription de l'appel et extrais les informations suivantes en JSON:
- prospectName: Nom du prospect (string)
- prospectEmail: Email du prospect (string ou null)
- prospectCompany: Entreprise du prospect (string ou null)
- callReason: Raison de l'appel (string)
- urgency: Niveau d'urgence (low, medium, high)
- shouldTransferToAgent: Doit-on transférer à un agent humain? (boolean)
- recommendedDepartment: Département recommandé (string ou null)
- notes: Notes additionnelles (string)

${
  tenantContext
    ? `Contexte de l'entreprise:
- Nom: ${tenantContext.tenantName}
- Type: ${tenantContext.businessType}
- Départements: ${tenantContext.departments.join(", ")}`
    : ""
}

Réponds UNIQUEMENT avec du JSON valide, sans markdown.`;

          const response = await invokeLLM(tenantId ?? 0, {
            model: AI_MODEL.DEFAULT,
            messages: [
              { role: "system", content: systemPrompt as unknown },
              { role: "user", content: `Transcription de l'appel:\n\n${transcription}` as unknown },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content as string;
          const qualification = JSON.parse(content || "{}");

          return {
            prospectName: qualification.prospectName || "Prospect inconnu",
            prospectEmail: qualification.prospectEmail,
            prospectPhone: callerPhone,
            prospectCompany: qualification.prospectCompany,
            callReason: qualification.callReason || "Raison non spécifiée",
            urgency: qualification.urgency ?? "medium",
            shouldTransferToAgent: qualification.shouldTransferToAgent ?? false,
            recommendedDepartment: qualification.recommendedDepartment,
            notes: qualification.notes ?? "",
          };
        })(),
        8000 // ✅ Timeout 8s via withTimeout
      );
    } catch (err: any) {
      const isTimeout =
        err?.message === "LLM timeout" ||
        (err?.message && err.message.toLowerCase().includes("timeout"));
      if (isTimeout) {
        logAITimeout("openai-qualification", { tenantId });
        return fallback();
      }
      throw err;
    }
  };

  return ResilienceService.execute(execution, {
    name: "openai-qualification",
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 60000 },
  });
}

/**
 * Perform deep business analysis of a call
 * ✅ AXE 1: Circuit Breaker + Fallback activé + asynchronisation non-bloquante
 */
export async function analyzeCallBusinessInsights(
  transcription: string,
  tenantId?: number
): Promise<BusinessInsights> {
  // ✅ Fallback activé (décommenté)
  const fallback = async (): Promise<BusinessInsights> => {
    logger.warn("[AI Service] Using fallback for business analysis", { tenantId });
    return {
      objections: [],
      intentions: [],
      keywords: [],
      summary: "Analyse différée (IA indisponible)",
      recommendations: ["Vérifier l'appel manuellement"],
      sentiment: "neutral",
      qualityScore: 50,
    };
  };

  const execution = async (): Promise<BusinessInsights> => {
    try {
      return await withTimeout(
        (async () => {
          const systemPrompt = `Tu es un expert en analyse métier et data engineer senior (BLOC 4 - Copilote Temps Réel).
Analyse cette transcription d'appel et extrais des insights business précis en JSON:
- objections: Liste des objections soulevées par le client
- intentions: Intentions détectées
- keywords: Mots-clés stratégiques mentionnés
- summary: Résumé synthétique de l'échange
- recommendations: Actions recommandées (3 phrases clés maximum pour l'agent)
- sentiment: positive, neutral ou negative (Indicateur visuel 😊/😐/😡)
- qualityScore: Score de qualité (0-100)
- actionItems: Liste d'actions concrètes (Shadow Agent - Validation requise)

LOGIQUE DE BRIDAGE (SÉCURITÉ):
- L'IA ne doit JAMAIS envoyer de message automatiquement sans validation humaine.
- Interdis à l'IA de s'engager sur des prix ou des contrats.

Réponds UNIQUEMENT en JSON valide.`;

          const response = await invokeLLM(tenantId ?? 0, {
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt as unknown },
              { role: "user", content: `Transcription de l'appel:\n\n${transcription}` as unknown },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content as string;
          const insights = JSON.parse(content || "{}");

          return {
            objections: insights.objections || [],
            intentions: insights.intentions || [],
            keywords: insights.keywords || [],
            summary: insights.summary || "Résumé non disponible",
            recommendations: insights.recommendations || [],
            sentiment: insights.sentiment ?? "neutral",
            qualityScore: insights.qualityScore ?? 50,
          };
        })(),
        5000 // ✅ Timeout 5s
      );
    } catch (err: any) {
      const isTimeout =
        err?.message === "LLM timeout" ||
        (err?.message && err.message.toLowerCase().includes("timeout"));
      if (isTimeout) {
        logAITimeout("openai-analysis", { tenantId });
        return fallback();
      }
      throw err;
    }
  };

  return ResilienceService.execute(execution, {
    name: "openai-analysis",
    circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 120000 },
  });
}

/**
 * ✅ CORRECTION AXE 2 — Scoring IA asynchrone non-bloquant (setImmediate)
 * Évite de bloquer tRPC lors du scoring post-appel
 */
export function runAIScoringAsync(
  callData: {
    transcription: string;
    tenantId?: number;
    callId?: string;
  },
  onComplete?: (insights: BusinessInsights) => void
): void {
  setImmediate(async () => {
    try {
      logger.info("[AI Service] Async scoring started", {
        module: "IA",
        callId: callData.callId,
        tenantId: callData.tenantId,
      });
      const insights = await analyzeCallBusinessInsights(
        callData.transcription,
        callData.tenantId
      );
      if (onComplete) onComplete(insights);
      logger.info("[AI Service] Async scoring completed", {
        module: "IA",
        callId: callData.callId,
        qualityScore: insights.qualityScore,
      });
    } catch (err: any) {
      logger.error("[AI Service] Async scoring failed", err, {
        module: "IA",
        callId: callData.callId,
      });
    }
  });
}

/**
 * Generate an AI response for the caller
 * ✅ Timeout 5s + fallback message
 */
export async function generateAIResponse(
  callerMessage: string,
  context: {
    tenantId: number;
    prospectName: string;
    callReason: string;
    tenantName: string;
  }
): Promise<string> {
  const execution = async (): Promise<string> => {
    try {
      return await withTimeout(
        (async () => {
          const systemPrompt = `Tu es un assistant téléphonique IA professionnel pour ${context.tenantName}.
Réponds en français de manière courtoise et concise.`;

          const response = await invokeLLM(context.tenantId, {
            model: AI_MODEL.DEFAULT,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Prospect: ${context.prospectName}\nMessage: ${callerMessage}` },
            ],
          });

          return typeof response.choices[0]?.message?.content === "string"
            ? response.choices[0].message.content
            : LLM_TIMEOUT_FALLBACK;
        })(),
        5000 // ✅ Timeout 5s pour l'IVR
      );
    } catch (err: any) {
      const isTimeout =
        err?.message === "LLM timeout" ||
        (err?.message && err.message.toLowerCase().includes("timeout"));
      if (isTimeout) {
        logAITimeout("openai-ivr", { tenantId: context.tenantId });
        return LLM_TIMEOUT_FALLBACK;
      }
      throw err;
    }
  };

  return ResilienceService.execute(execution, {
    name: "openai-ivr",
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30000 },
  });
}

/**
 * Transcribe audio from a call recording
 */
export async function transcribeCallRecording(
  audioUrl: string,
  language: string = "fr",
  tenantId?: number
): Promise<string> {
  try {
    const result = await transcribeAudio({ audioUrl, language });
    return "text" in result ? result.text ?? "" : "";
  } catch (error: any) {
    logger.error("[AI Service] Error transcribing call", error, { tenantId });
    throw error;
  }
}

/**
 * Generate a concise summary of a call
 */
export async function generateCallSummary(
  transcription: string,
  context: {
    duration: number;
    callReason: string;
    prospectName: string;
  }
): Promise<string> {
  try {
    const response = await invokeLLM(0, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: "Tu es un assistant de synthèse d'appels. Résume l'échange de manière concise et professionnelle." },
        { role: "user", content: `Prospect: ${context.prospectName}\nRaison: ${context.callReason}\nDurée: ${context.duration}s\n\nTranscription:\n${transcription}` },
      ],
    });
    return typeof response.choices[0]?.message?.content === "string" ? response.choices[0].message.content : "Résumé indisponible";
  } catch (error: any) {
    logger.error("[AI Service] Error generating call summary", error);
    return "Erreur lors de la génération du résumé";
  }
}

/**
 * Analyze call quality and sentiment
 */
export async function analyzeCallQuality(transcription: string): Promise<{ qualityScore: number; sentiment: string; feedback: string }> {
  try {
    const response = await invokeLLM(0, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { 
          role: "system", 
          content: "Analyse la qualité technique (fluidité, clarté) et le sentiment de cet appel. Réponds en JSON: { qualityScore: number (0-100), sentiment: 'positive'|'neutral'|'negative', feedback: string }" 
        },
        { role: "user", content: transcription },
      ],
      response_format: { type: "json_object" },
    });
    const content = (response.choices[0]?.message?.content as string);
    const data = JSON.parse(content || '{"qualityScore": 50, "sentiment": "neutral", "feedback": ""}');
    return {
      qualityScore: data.qualityScore ?? 50,
      sentiment: data.sentiment ?? "neutral",
      feedback: data.feedback ?? ""
    };
  } catch (error: any) {
    logger.error("[AI Service] Error analyzing call quality", error);
    return { qualityScore: 50, sentiment: "neutral", feedback: "Erreur d'analyse" };
  }
}

/**
 * Extract action items from a call transcription
 */
export async function extractActionItems(transcription: string): Promise<string[]> {
  try {
    const response = await invokeLLM(0, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: "Extrais une liste d'actions concrètes à faire suite à cet appel. Réponds en JSON: { actions: string[] }" },
        { role: "user", content: transcription },
      ],
      response_format: { type: "json_object" },
    });
    const content = (response.choices[0]?.message?.content as string);
    const data = JSON.parse(content || '{"actions": []}');
    return data.actions || [];
  } catch (error: any) {
    logger.error("[AI Service] Error extracting action items", error);
    return [];
  }
}

/**
 * Generate a completion using the LLM
 */
export async function generateCompletion(params: {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  try {
    const response = await invokeLLM(0, {
      model: params.model || AI_MODEL.DEFAULT,
      messages: [
        ...(params.systemPrompt ? [{ role: "system" as const, content: params.systemPrompt }] : []),
        { role: "user" as const, content: params.prompt },
      ],
      temperature: params.temperature ?? 0.7,
    });
    
    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch (error: any) {
    logger.error("[AI Service] Error generating completion", error);
    throw error;
  }
}

/**
 * Analyze a document using AI
 */
export async function analyzeDocument(params: {
  content: string;
  type?: string;
  instructions?: string;
}): Promise<any> {
  try {
    const systemPrompt = params.instructions || "Analyse ce document et extrais les informations clés.";
    
    const response = await invokeLLM(0, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.content },
      ],
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content;
    return { analysis: typeof content === "string" ? content : "" };
  } catch (error: any) {
    logger.error("[AI Service] Error analyzing document", error);
    throw error;
  }
}
