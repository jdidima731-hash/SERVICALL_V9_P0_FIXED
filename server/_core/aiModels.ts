/**
 * AI MODELS CONFIGURATION
 * Source unique de vérité pour tous les modèles OpenAI utilisés dans Servicall.
 * ✅ PHASE 1 — Tâche 1 : Standardisation des modèles IA
 *
 * IMPORTANT : Le seul modèle autorisé en production est gpt-4o-mini.
 * Toute référence à gpt-3.5-turbo, gpt-4, gpt-4-turbo-preview, gpt-4.1-mini
 * ou gpt-4.1-nano est INTERDITE et doit être remplacée par AI_MODEL.DEFAULT.
 */
export const AI_MODEL = {
  /**
   * Modèle par défaut pour tous les appels LLM de l'application.
   * Remplace : gpt-3.5-turbo, gpt-4, gpt-4-turbo-preview, gpt-4.1-mini, gpt-4.1-nano
   */
  DEFAULT: "gpt-4o-mini",
  REALTIME: "gpt-4o-realtime-preview",

  /**
   * Modèle pour la transcription audio (Whisper)
   */
  WHISPER: "whisper-1",

  /**
   * Modèle pour la synthèse vocale (TTS)
   */
  TTS: "tts-1",
  VAD_SETTINGS: {
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500,
  },
} as const;

export type AIModelType = (typeof AI_MODEL)[keyof typeof AI_MODEL];
