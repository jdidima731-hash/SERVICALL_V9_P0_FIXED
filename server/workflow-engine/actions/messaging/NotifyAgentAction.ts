/**
 * NOTIFY AGENT ACTION
 * Envoie une notification interne à un agent.
 * ✅ BLOC AUDIT : Durcissement Zod
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

const NotifyAgentConfigSchema = z.object({
  agent_id: z.number().optional(),
  message: z.string().min(1, "Le message de notification est obligatoire"),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  channel: z.enum(['internal', 'email', 'sms', 'push']).default('internal'),
});

type NotifyAgentConfig = z.infer<typeof NotifyAgentConfigSchema>;

interface NotifyAgentResult {
  method: string;
  recipient: string;
  status: string;
}

export class NotifyAgentAction implements ActionHandler<NotifyAgentConfig, FinalExecutionContext, NotifyAgentResult> {
  name = 'notify_agent';
  private logger = new Logger('NotifyAgentAction');

  async execute(
    context: FinalExecutionContext,
    config: NotifyAgentConfig
  ): Promise<ActionResult<NotifyAgentResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = NotifyAgentConfigSchema.parse(config);

      const agentId = validatedConfig.agent_id || context.variables.prospect?.assignedTo;

      this.logger.info('Notifying agent...', {
        agentId,
        channel: validatedConfig.channel,
        priority: validatedConfig.priority
      });

      // Logique de notification réelle à implémenter via NotificationService
      
      return { 
        success: true, 
        data: { 
          method: validatedConfig.channel, 
          recipient: agentId ? `agent_${agentId}` : "unassigned",
          status: "sent"
        } 
      };
    } catch (error: unknown) {
      this.logger.error('Failed to notify agent', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      NotifyAgentConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
