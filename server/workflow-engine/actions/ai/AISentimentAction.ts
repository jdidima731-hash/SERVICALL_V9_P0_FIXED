/**
 * AI SENTIMENT ACTION
 * Analyse le sentiment d'un texte via le service d'analyse.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { quickSentimentAnalysis } from "../../services/sentimentAnalysisService";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const AISentimentConfigSchema = z.object({
  text: z.string().optional(),
});
type AISentimentConfig = z.infer<typeof AISentimentConfigSchema>;

/** Mappage du sentiment du service vers le type AIData */
function mapSentiment(s: string): 'positif' | 'negatif' | 'neutre' {
  if (s === 'positive') return 'positif';
  if (s === 'negative' || s === 'angry' || s === 'frustrated' || s === 'stressed') return 'negatif';
  return 'neutre';
}

// Résultat structuré
interface AISentimentResult {
  sentiment: 'positif' | 'negatif' | 'neutre';
  score: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  emotions?: Record<string, number>;
}

export class AISentimentAction implements ActionHandler<AISentimentConfig, FinalExecutionContext, AISentimentResult> {
  name = 'ai_sentiment_analysis';
  private logger = new Logger('AISentimentAction');

  async execute(
    context: FinalExecutionContext,
    config: AISentimentConfig
  ): Promise<ActionResult<AISentimentResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AISentimentConfigSchema.parse(config);

      // Accès typé via les variables structurées
      const textToAnalyze =
        config.text ??
        context.variables.transcription ??
        context.variables.last_message;

      if (!textToAnalyze) {
        return { success: false, error: 'No text provided for sentiment analysis' };
      }

      const result = await quickSentimentAnalysis(textToAnalyze);

      const output: AISentimentResult = {
        sentiment: mapSentiment(result.sentiment),
        score: result.score,
        shouldEscalate: result.shouldEscalate,
        escalationReason: result.escalationReason,
        emotions: result.emotions
      };

      // Mise à jour du contexte structuré
      context.variables.ai = {
        ...(context.variables.ai ?? {}),
        sentiment: output.sentiment,
        score: output.score,
      };

      return { success: true, data: output };
    } catch (error: unknown) {
      this.logger.error('Failed to perform AI sentiment analysis', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      AISentimentConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
