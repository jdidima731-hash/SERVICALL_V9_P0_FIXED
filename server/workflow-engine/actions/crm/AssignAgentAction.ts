import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const AssignAgentConfigSchema = z.object({
  agentId: z.union([z.string(), z.number()]).optional(),
});
type AssignAgentConfig = z.infer<typeof AssignAgentConfigSchema>;

interface AssignAgentResult { agentId: string; }

export class AssignAgentAction implements ActionHandler<AssignAgentConfig, FinalExecutionContext, AssignAgentResult> {
  name = 'assign_agent';
  private logger = new Logger('AssignAgentAction');

  async execute(
    _context: FinalExecutionContext,
    config: AssignAgentConfig
  ): Promise<ActionResult<AssignAgentResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = AssignAgentConfigSchema.parse(config);

      this.logger.info('Assigning agent in CRM...');
      return { success: true, data: { agentId: String(config.agentId ?? "agent_auto") } };
    } catch (error: unknown) {
      return { success: false, error: String(error) };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      AssignAgentConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
