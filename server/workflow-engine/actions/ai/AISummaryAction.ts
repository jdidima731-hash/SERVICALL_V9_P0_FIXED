import { AI_MODEL } from "../../_core/aiModels";
/**
 * AI SUMMARY ACTION
 * Résume un texte ou une transcription.
 * ✅ BLOC 3 : Fallback intelligent et Output explicite.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { invokeLLM } from "../../_core/llm";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const AISummaryConfigSchema = z.object({
  text: z.string().optional(),
  type: z.enum(['standard', 'action_items', 'sentiment_focus']).optional(),
});
type AISummaryConfig = z.infer<typeof AISummaryConfigSchema>;

// Résultat structuré
interface AISummaryResult {
  summary: string;
  summary_type: string;
  source_length: number;
}

export class AISummaryAction implements ActionHandler<AISummaryConfig, FinalExecutionContext, AISummaryResult> {
  name = 'ai_summary';
  private logger = new Logger('AISummaryAction');

  async execute(
    context: FinalExecutionContext,
    config: AISummaryConfig
  ): Promise<ActionResult<AISummaryResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AISummaryConfigSchema.parse(config);

      // Accès typé via les variables structurées
      const eventData = context.event.data as Record<string, unknown>;
      const textToSummarize =
        config.text ??
        context.variables.transcription ??
        context.variables.last_message ??
        (typeof eventData['text'] === 'string' ? eventData['text'] : undefined);

      const summaryType = config.type ?? 'standard';

      if (!textToSummarize) {
        this.logger.warn('No text found for summarization, using empty fallback');
        return { success: false, error: 'No text provided for summarization' };
      }

      let prompt = 'Résume le texte suivant de manière concise et professionnelle.';
      if (summaryType === 'action_items') {
        prompt = 'Extrait uniquement les points d\'action et les prochaines étapes du texte suivant.';
      } else if (summaryType === 'sentiment_focus') {
        prompt = 'Résume le texte en mettant l\'accent sur le sentiment du client et ses frustrations éventuelles.';
      }

      const sanitizedText = textToSummarize.replace(/<[^>]*>?/gm, '').substring(0, 10000);

      const response = await invokeLLM(context.tenant.id, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: 'system', content: prompt as unknown },
          { role: 'user', content: `TEXTE A RESUMER:\n"""\n${sanitizedText}\n"""` as unknown },
        ],
      });

      const rawSummary = (response as unknown).choices[0]?.message?.content ?? '';
      const summary = typeof rawSummary === 'string'
        ? rawSummary
        : ((rawSummary[0] as { type: string; text?: string }).text ?? '');

      const output: AISummaryResult = {
        summary: summary.trim(),
        summary_type: summaryType,
        source_length: textToSummarize.length
      };

      // Mise à jour du contexte structuré
      context.variables.ai = {
        ...(context.variables.ai ?? {}),
        summary: output.summary,
      };
      context.variables.ai_summary = output.summary;

      return { success: true, data: output };
    } catch (error: unknown) {
      this.logger.error('AI Summarization failed', { error, workflow_id: context.workflow.id });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = AISummaryConfigSchema.safeParse(config);
    return result.success;
  }
}
