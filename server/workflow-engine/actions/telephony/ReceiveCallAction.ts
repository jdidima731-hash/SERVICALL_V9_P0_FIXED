/**
 * RECEIVE CALL ACTION
 * Gère la réception d'un appel entrant (CALL_IN)
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const ReceiveCallConfigSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type ReceiveCallConfig = z.infer<typeof ReceiveCallConfigSchema>;

// Résultat structuré
interface ReceiveCallResult {
  call_sid: string;
  from: string;
  to: string;
  direction: 'inbound';
  status: 'received';
  tenant_id: number;
  received_at: Date;
  metadata: Record<string, unknown>;
}

export class ReceiveCallAction implements ActionHandler<ReceiveCallConfig, FinalExecutionContext, ReceiveCallResult> {
  name = 'receive_call';
  private logger = new Logger('ReceiveCallAction');

  async execute(
    context: FinalExecutionContext,
    config: ReceiveCallConfig
  ): Promise<ActionResult<ReceiveCallResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = ReceiveCallConfigSchema.parse(config);

      const callData: ReceiveCallResult = {
        call_sid: context.event.id,
        from: context.event.source,
        to: context.event.destination,
        direction: 'inbound',
        status: 'received',
        tenant_id: context.tenant.id,
        received_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          ...(config.metadata ?? {}),
        }
      };

      // Stocker les informations de l'appel dans le contexte structuré
      context.variables.call = {
        call_sid: callData.call_sid,
      };
      context.variables.caller_phone = context.event.source;

      this.logger.info('Call received', {
        from: callData.from,
        to: callData.to,
        tenant: context.tenant.id
      });

      return { success: true, data: callData };
    } catch (error: unknown) {
      this.logger.error('Failed to receive call', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      ReceiveCallConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
