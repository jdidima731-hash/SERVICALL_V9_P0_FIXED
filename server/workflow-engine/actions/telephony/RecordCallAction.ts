/**
 * RECORD CALL ACTION
 * Gère l'enregistrement d'un appel téléphonique
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const RecordCallConfigSchema = z.object({
  recording_url: z.string().url().optional(),
  duration: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type RecordCallConfig = z.infer<typeof RecordCallConfigSchema>;

// Résultat structuré
interface RecordCallResult {
  call_sid: string;
  tenant_id: number;
  recording_url: string | undefined;
  duration: number;
  status: 'recorded';
  recorded_at: Date;
  metadata: Record<string, unknown>;
}

export class RecordCallAction implements ActionHandler<RecordCallConfig, FinalExecutionContext, RecordCallResult> {
  name = 'record_call';
  private logger = new Logger('RecordCallAction');

  async execute(
    context: FinalExecutionContext,
    config: RecordCallConfig
  ): Promise<ActionResult<RecordCallResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = RecordCallConfigSchema.parse(config);

      const callSid = context.variables.call?.call_sid ?? context.event.id;
      const eventData = context.event.data as Record<string, unknown>;

      const recordingUrl =
        config.recording_url ??
        (typeof eventData['recording_url'] === 'string' ? eventData['recording_url'] : undefined);

      const duration =
        config.duration ??
        (typeof eventData['duration'] === 'number' ? eventData['duration'] : 0);

      const recordingData: RecordCallResult = {
        call_sid: callSid,
        tenant_id: context.tenant.id,
        recording_url: recordingUrl,
        duration,
        status: 'recorded',
        recorded_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          auto_recorded: true,
          ...(config.metadata ?? {}),
        }
      };

      // Stocker les informations d'enregistrement dans le contexte structuré
      context.variables['recording'] = recordingData;
      context.variables.recording_url = recordingData.recording_url;

      this.logger.info('Call recorded', {
        call_sid: callSid,
        duration: recordingData.duration,
        tenant: context.tenant.id
      });

      return { success: true, data: recordingData };
    } catch (error: unknown) {
      this.logger.error('Failed to record call', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      RecordCallConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
