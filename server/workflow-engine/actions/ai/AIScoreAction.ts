/**
 * AI SCORE ACTION
 * Utilise le service scoringService existant du projet
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { calculateLeadScore } from "../../../../server/services/scoringService";
import { getDbInstance } from "../../../../server/db";
import { prospects } from "../../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const AIScoreConfigSchema = z.object({
  prospectId: z.number().optional(),
});
type AIScoreConfig = z.infer<typeof AIScoreConfigSchema>;

// Résultat structuré
interface AIScoreResult {
  score: number;
  qualification: string;
}

export class AIScoreAction implements ActionHandler<AIScoreConfig, FinalExecutionContext, AIScoreResult> {
  name = "ai_score";
  private logger = new Logger("AIScoreAction");

  async execute(
    context: FinalExecutionContext,
    config: AIScoreConfig
  ): Promise<ActionResult<AIScoreResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AIScoreConfigSchema.parse(config);

      // Accès typé via les variables structurées
      const prospectId: number | undefined =
        context.variables.prospect?.id ?? config.prospectId;

      if (!prospectId) {
        return { success: false, error: "No prospect ID found for scoring" };
      }

      const db = getDbInstance();
      const prospectExists = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      if (prospectExists.length === 0) {
        return { success: false, error: `Prospect ${prospectId} not found` };
      }

      const scoreResult = await calculateLeadScore(prospectId);

      const existingMetadata =
        (context.variables.prospect?.metadata as Record<string, unknown> | undefined) ?? {};

      
      const dbUpd = getDbInstance();
      await dbUpd.update(prospects).set({
        metadata: {
          ...existingMetadata,
          ai_score: scoreResult.score,
          ai_qualification: scoreResult.qualification
        }
      }).where(eq(prospects.id, prospectId));

      // Mise à jour du contexte structuré
      context.variables.ai_score = scoreResult.score;
      if (context.variables.prospect) {
        context.variables.prospect.status = scoreResult.qualification;
      }

      return {
        success: true,
        data: {
          score: scoreResult.score,
          qualification: scoreResult.qualification
        }
      };
    } catch (error: unknown) {
      this.logger.error("Failed to calculate AI score", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      AIScoreConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}