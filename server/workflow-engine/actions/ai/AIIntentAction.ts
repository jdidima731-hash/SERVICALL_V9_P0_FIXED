/**
 * AI INTENT ACTION
 * Détecte l'intention du client à partir d'une transcription ou d'un message.
 * ✅ BLOC 3 : Support des fallbacks intelligents et variables d'output standardisées
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { invokeLLM } from "../../_core/llm";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const AIIntentConfigSchema = z.object({
  text: z.string().optional(),
});
type AIIntentConfig = z.infer<typeof AIIntentConfigSchema>;

// Résultat structuré
interface AIIntentResult {
  detected_intent: string;
  intent_confidence: number;
  is_quote_request: boolean;
  is_appointment: boolean;
  is_complaint: boolean;
}

export class AIIntentAction implements ActionHandler<AIIntentConfig, FinalExecutionContext, AIIntentResult> {
  name = 'ai_intent';
  private logger = new Logger('AIIntentAction');

  async execute(
    context: FinalExecutionContext,
    config: AIIntentConfig
  ): Promise<ActionResult<AIIntentResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AIIntentConfigSchema.parse(config);

      // Accès typé via les variables structurées
      const eventData = context.event.data as Record<string, unknown>;
      const text =
        config.text ??
        context.variables.transcription ??
        context.variables.last_message ??
        (typeof eventData['text'] === 'string' ? eventData['text'] : undefined);

      if (!text) {
        return { success: false, error: 'Aucun texte fourni pour l\'analyse d\'intention' };
      }

      const prompt = `
        Analyse le texte suivant et détermine l'intention principale du client.
        Choisis parmi les catégories suivantes : [DEMANDE_DEVIS, PRISE_RDV, RECLAMATION, QUESTION_TECHNIQUE, AUTRE].
        Réponds uniquement avec le nom de la catégorie et un score de confiance entre 0 et 1.
        Format: CATEGORIE|SCORE
        
        Texte : "${text}"
      `;

      const response = await invokeLLM(context.tenant.id, {
        messages: [
          { role: 'system', content: 'Tu es un expert en analyse d\'intentions client.' as unknown },
          { role: 'user', content: prompt as unknown }
        ],
      });

      const rawMessage = (response as unknown).choices[0]?.message?.content ?? 'AUTRE|0';
      const rawContent = typeof rawMessage === 'string'
        ? rawMessage
        : ((rawMessage[0] as { type: string; text?: string }).text ?? 'AUTRE|0');
      const [intentRaw, scoreStr] = rawContent.split('|');
      const intent = (intentRaw ?? 'AUTRE').trim();
      const score = parseFloat(scoreStr ?? '0') || 0;

      this.logger.info(`Intention détectée : ${intent} (${score})`);

      const output: AIIntentResult = {
        detected_intent: intent,
        intent_confidence: score,
        is_quote_request: intent === 'DEMANDE_DEVIS',
        is_appointment: intent === 'PRISE_RDV',
        is_complaint: intent === 'RECLAMATION'
      };

      // Mise à jour du contexte structuré
      context.variables.ai = {
        ...(context.variables.ai ?? {}),
        intent: output.detected_intent,
      };

      return { success: true, data: output };
    } catch (error: unknown) {
      this.logger.error('Échec de l\'analyse d\'intention', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      AIIntentConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
