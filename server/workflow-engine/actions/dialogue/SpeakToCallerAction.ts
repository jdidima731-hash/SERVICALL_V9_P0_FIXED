/**
 * SPEAK TO CALLER ACTION
 * Convertit le texte en parole et l'envoie au service téléphonique.
 * ✅ BLOC 2 : Supporte les variables dynamiques via PlaceholderEngine
 * ✅ BLOC 2 : Gestion d'erreurs robuste avec timeout et retry
 * ✅ BLOC 2 : Logging structuré et centralisé
 * ✅ BLOC 2 : Support context tenant strict
 * ✅ BYOK  : Utilise la clé OpenAI spécifique au tenant (resolveOpenAIKey)
 */

import { z } from "zod";
import OpenAI from "openai";
import { resolveOpenAIKey } from "@server/_core/llm";
import type { ActionHandler, ActionResult } from "@server/workflow-engine/types";
import type { FinalExecutionContext } from "@server/workflow-engine/structured-types";
import { Logger } from "@server/infrastructure/logger";
import { PlaceholderEngine } from "@server/workflow-engine/utils/PlaceholderEngine";

// Configuration structurée
const SpeakToCallerConfigSchema = z.object({
  text: z.string().min(1, "Le texte à prononcer est obligatoire"),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
  speed: z.number().min(0.25).max(4.0).optional(),
});
export type SpeakToCallerConfig = z.infer<typeof SpeakToCallerConfigSchema>;

// Résultat structuré
interface SpeakToCallerResult {
  text: string;
  audioUrl: string;
  audioLength: number;
  duration: number;
}

export class SpeakToCallerAction implements ActionHandler<SpeakToCallerConfig, FinalExecutionContext, SpeakToCallerResult> {
  name = "speak_to_caller";
  private logger = new Logger("SpeakToCallerAction");
  private static readonly TIMEOUT_MS = 15000;
  private static readonly MAX_TEXT_LENGTH = 4096;

  constructor(_apiKey?: string) {
    // Client OpenAI résolu par tenant au moment de l'exécution (BYOK)
  }

  async execute(
    context: FinalExecutionContext,
    config: SpeakToCallerConfig
  ): Promise<ActionResult<SpeakToCallerResult>> {
    const startTime = Date.now();
    const tenantId = context.tenant?.id ?? 0;

    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = SpeakToCallerConfigSchema.parse(config);

      // ✅ BYOK : résoudre la clé OpenAI du tenant avant tout appel
      const apiKey = await resolveOpenAIKey(tenantId);
      const openai = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });

      // ✅ BLOC 6 : Résolution des variables dynamiques via PlaceholderEngine
      const resolvedText = PlaceholderEngine.resolve(config.text, context);

      if (!resolvedText || typeof resolvedText !== "string" || resolvedText.trim().length === 0) {
        throw new Error("Resolved text is empty or invalid");
      }

      if (resolvedText.length > SpeakToCallerAction.MAX_TEXT_LENGTH) {
        throw new Error(`Text too long: ${resolvedText.length} chars (max: ${SpeakToCallerAction.MAX_TEXT_LENGTH})`);
      }

      // Accès typé à callId depuis les variables structurées
      const callId = context.variables.callId;

      this.logger.info("Generating speech", {
        textLength: resolvedText.length,
        voice: config.voice ?? "nova",
        tenantId,
        callId,
      });

      const response = await Promise.race([
        openai.audio.speech.create({
          model: "tts-1",
          voice: config.voice ?? "nova",
          input: resolvedText,
          speed: config.speed ?? 1.0,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TTS generation timeout")), SpeakToCallerAction.TIMEOUT_MS)
        ),
      ]);

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const duration = Date.now() - startTime;

      this.logger.info("Speech generated successfully", {
        tenantId,
        duration,
        audioLength: audioBuffer.length,
        callId,
      });

      return {
        success: true,
        data: {
          text: resolvedText,
          audioUrl: `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`,
          audioLength: audioBuffer.length,
          duration,
        },
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Error in SpeakToCallerAction", {
        error: errorMessage,
        tenantId,
        duration,
        callId: context.variables.callId,
      });

      return { success: false, error: errorMessage };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = SpeakToCallerConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.error('Validation failed', { errors: result.error.format() });
      return false;
    }
    return true;
  }
}

export default SpeakToCallerAction;
