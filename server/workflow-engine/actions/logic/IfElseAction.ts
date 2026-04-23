/**
 * IF/ELSE LOGIC ACTION
 * Évalue une condition et détermine la branche à suivre.
 * ✅ BLOC 4 : Support des branches on_true et on_false.
 * ✅ BLOC 3 : Validation stricte via Zod.
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";
import { ConditionEvaluator, Rule, ConditionGroup } from "../../utils/ConditionEvaluator";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION STRUCTURÉE
// ─────────────────────────────────────────────────────────────────────────────

const IfElseConfigSchema = z.object({
  rules: z.unknown().refine(v => v !== undefined && v !== null, {
    message: "Les règles de la condition sont obligatoires",
  }),
  on_true: z.string().optional(),
  on_false: z.string().optional(),
});

type IfElseConfig = z.infer<typeof IfElseConfigSchema>;

// Résultat structuré de l'action
interface IfElseResult {
  branch: 'if' | 'else';
  evaluated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION
// ─────────────────────────────────────────────────────────────────────────────

export class IfElseAction implements ActionHandler<IfElseConfig, FinalExecutionContext, IfElseResult> {
  name = 'logic_if_else';
  private logger = new Logger('IfElseAction');
  private evaluator = new ConditionEvaluator();

  async execute(
    context: FinalExecutionContext,
    config: IfElseConfig
  ): Promise<ActionResult<IfElseResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = IfElseConfigSchema.parse(config);

      this.logger.info('Evaluating IF/ELSE condition', {
        workflow_id: context.workflow.id,
        event_id: context.event.id
      });

      const rules = config.rules as Rule | ConditionGroup | (Rule | ConditionGroup)[];
      const isTrue = this.evaluator.evaluate(rules, context);

      this.logger.info(`Condition result: ${isTrue}`);

      return {
        success: true,
        data: {
          branch: isTrue ? 'if' : 'else',
          evaluated_at: new Date().toISOString()
        }
      };
    } catch (error: unknown) {
      this.logger.error('Error in IfElseAction', { error });
      return { success: false, error: String(error) };
    }
  }

  /**
   * ✅ BLOC 3 : Validation stricte via Zod
   */
  validate(config: Record<string, unknown>): boolean {
    const result = IfElseConfigSchema.safeParse(config);
    if (!result.success) {
      this.logger.error('Validation failed', { errors: result.error.format() });
      return false;
    }
    const hasDestination = !!(result.data.on_true || result.data.on_false);
    if (!hasDestination) {
      this.logger.error('Validation failed: Missing on_true or on_false destination');
    }
    return hasDestination;
  }
}
