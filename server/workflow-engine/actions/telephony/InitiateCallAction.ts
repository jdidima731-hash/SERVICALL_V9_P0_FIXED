/**
 * INITIATE CALL ACTION
 * Gère le déclenchement d'un appel sortant (CALL_OUT)
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "@server/workflow-engine/types";
import type { FinalExecutionContext } from "@server/workflow-engine/structured-types";
import { Logger } from "@server/infrastructure/logger";
import * => twilioService from "@server/services/twilioService";

// Configuration structurée
const InitiateCallConfigSchema = z.object({
  to: z.string().optional(),
  from: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type InitiateCallConfig = z.infer<typeof InitiateCallConfigSchema>;

// Résultat structuré
interface InitiateCallResult {
  call_sid: string;
  from: string;
  to: string;
  direction: 'outbound';
  status: 'initiated';
  tenant_id: number;
  initiated_at: Date;
  metadata: Record<string, unknown>;
}

export class InitiateCallAction implements ActionHandler<InitiateCallConfig, FinalExecutionContext, InitiateCallResult> {
  name = 'initiate_call';
  private logger = new Logger('InitiateCallAction');

  async execute(
    context: FinalExecutionContext,
    config: InitiateCallConfig
  ): Promise<ActionResult<InitiateCallResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = InitiateCallConfigSchema.parse(config);

      const toNumber = config.to ?? context.variables.phone ?? context.variables.caller_phone;
      const fromNumber = config.from ?? context.tenant.phoneNumber ?? "";

      if (!toNumber) {
        throw new Error('No destination phone number provided');
      }

      const call = await twilioService.createOutboundCall(
        toNumber,
        context.tenant.id,
        context.variables.prospectId, // Assurez-vous que prospectId est disponible dans le contexte si nécessaire
        false // isAI, à adapter si l'IA peut initier des appels via ce workflow
      );

      const callData: InitiateCallResult = {
        call_sid: call.sid,
        from: fromNumber, // Le numéro 'from' sera géré par twilioService
        to: toNumber,
        direction: 'outbound',
        status: 'initiated',
        tenant_id: context.tenant.id,
        initiated_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          reason: config.reason ?? 'workflow_triggered',
          ...(config.metadata ?? {}),
        }
      };

      context.variables.call = { call_sid: call.sid };
      context.variables['outbound_call_sid'] = call.sid;

      this.logger.info('Call initiated via TwilioService', {
        from: callData.from,
        to: callData.to,
        tenant: context.tenant.id,
        callSid: call.sid,
        reason: callData.metadata['reason']
      });

      return { success: true, data: callData };
    } catch (error: unknown) {
      this.logger.error('Failed to initiate call', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      InitiateCallConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
