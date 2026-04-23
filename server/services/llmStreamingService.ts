/**
 * LLM STREAMING SERVICE
 * ✅ PHASE 3 — Tâche 8 : Streaming LLM token par token
 *
 * Utilise openai.chat.completions.stream() pour permettre la génération
 * token par token, réduisant la latence perçue dans le pipeline vocal.
 *
 * Latence cible : <500 ms pour le premier token.
 */
import WebSocket from "ws";
import { getOpenAIClient } from "../_core/openaiClient";
import { AI_MODEL } from "../_core/aiModels";
import { logger } from "../infrastructure/logger";

export interface StreamingOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Génère une réponse LLM en streaming et accumule les tokens.
 * Appelle onToken à chaque token reçu et onComplete avec le texte complet.
 *
 * @returns Le texte complet généré
 */
export async function streamChatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: StreamingOptions = {}
): Promise<string> {
  const openai = getOpenAIClient();
  const model = options.model ?? AI_MODEL.DEFAULT;
  const startTime = Date.now();

  logger.info("[LLM Streaming] Starting stream", { model, messageCount: messages.length });

  let fullText = "";
  let firstTokenMs: number | null = null;

  try {
    const stream = openai.chat.completions.stream({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";

      if (token) {
        if (firstTokenMs === null) {
          firstTokenMs = Date.now() - startTime;
          logger.debug("[LLM Streaming] First token received", {
            model,
            firstTokenMs,
          });
        }

        fullText += token;
        options.onToken?.(token);
      }
    }

    const totalMs = Date.now() - startTime;
    logger.info("[LLM Streaming] Stream completed", {
      model,
      firstTokenMs,
      totalMs,
      chars: fullText.length,
    });

    options.onComplete?.(fullText);
    return fullText;
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[LLM Streaming] Stream error", err, { model });
    options.onError?.(err);
    throw err;
  }
}

/**
 * Streaming LLM vers WebSocket Twilio.
 * Envoie chaque phrase complète (délimitée par . ! ?) dès qu'elle est disponible
 * pour minimiser la latence vocale.
 *
 * @param ws WebSocket Twilio Media Stream
 * @param messages Historique de conversation
 * @param onSentence Callback appelé pour chaque phrase complète (pour TTS)
 */
export async function streamToVoice(
  _ws: WebSocket,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  onSentence: (sentence: string) => Promise<void>,
  options: StreamingOptions = {}
): Promise<string> {
  let buffer = "";
  let fullText = "";

  const flushSentence = async () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 0) {
      logger.debug("[LLM Streaming] Flushing sentence to TTS", { length: trimmed.length });
      await onSentence(trimmed);
      buffer = "";
    }
  };

  await streamChatCompletion(messages, {
    ...options,
    onToken: async (token) => {
      buffer += token;
      fullText += token;

      // Envoyer la phrase dès qu'elle est complète (ponctuation forte)
      if (/[.!?]\s*$/.test(buffer) && buffer.trim().length > 10) {
        await flushSentence();
      }
    },
    onComplete: async () => {
      // Envoyer le reste du buffer
      await flushSentence();
    },
  });

  return fullText;
}

/**
 * Streaming LLM avec réponse JSON forcée.
 * Accumule tous les tokens et parse le JSON à la fin.
 */
export async function streamJsonCompletion<T = unknown>(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: StreamingOptions = {}
): Promise<T> {
  const openai = getOpenAIClient();
  const model = options.model ?? AI_MODEL.DEFAULT;

  logger.info("[LLM Streaming] Starting JSON stream", { model });

  let fullText = "";

  try {
    const stream = openai.chat.completions.stream({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
      response_format: { type: "json_object" },
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        fullText += token;
        options.onToken?.(token);
      }
    }

    const parsed = JSON.parse(fullText) as T;
    options.onComplete?.(fullText);
    return parsed;
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[LLM Streaming] JSON stream error", err, { model });
    options.onError?.(err);
    throw err;
  }
}
