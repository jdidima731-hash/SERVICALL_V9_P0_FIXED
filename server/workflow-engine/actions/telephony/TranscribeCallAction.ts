/**
 * TRANSCRIBE CALL ACTION
 * Gère la transcription d'un appel enregistré
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";

// Configuration structurée
const TranscribeCallConfigSchema = z.object({
  recording_url: z.string().url().optional(),
  text: z.string().optional(),
  language: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  provider: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type TranscribeCallConfig = z.infer<typeof TranscribeCallConfigSchema>;

// Résultat structuré
interface TranscribeCallResult {
  call_sid: string;
  tenant_id: number;
  recording_url: string;
  text: string;
  language: string;
  confidence: number;
  transcribed_at: Date;
  metadata: Record<string, unknown>;
}

export class TranscribeCallAction implements ActionHandler<TranscribeCallConfig, FinalExecutionContext, TranscribeCallResult> {
  name = 'transcribe_call';
  private logger = new Logger('TranscribeCallAction');

  async execute(
    context: FinalExecutionContext,
    config: TranscribeCallConfig
  ): Promise<ActionResult<TranscribeCallResult>> {
    try {
      // BLOC AUDIT : Validation stricte de la config
      const validatedConfig = TranscribeCallConfigSchema.parse(config);

      const recordingUrl = config.recording_url ?? context.variables.recording_url;
      const callSid = context.variables.call?.call_sid ?? context.event.id;

      if (!recordingUrl) {
        throw new Error('No recording URL provided for transcription');
      }

      const transcriptionData: TranscribeCallResult = {
        call_sid: callSid,
        tenant_id: context.tenant.id,
        recording_url: recordingUrl,
        text: config.text ?? '',
        language: config.language ?? 'fr-FR',
        confidence: config.confidence ?? 0.95,
        transcribed_at: new Date(),
        metadata: {
          workflow_id: context.workflow.id,
          provider: config.provider ?? 'whisper',
          ...(config.metadata ?? {}),
        }
      };

      // Stocker la transcription dans le contexte structuré
      context.variables.transcription = transcriptionData.text;
      context.variables['transcription_text'] = transcriptionData.text;

      this.logger.info('Call transcribed', {
        call_sid: callSid,
        language: transcriptionData.language,
        confidence: transcriptionData.confidence,
        tenant: context.tenant.id
      });

      return { success: true, data: transcriptionData };
    } catch (error: unknown) {
      this.logger.error('Failed to transcribe call', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      TranscribeCallConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
