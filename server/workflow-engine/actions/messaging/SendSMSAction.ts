/**
 * SEND SMS ACTION
 * Envoie un SMS via Twilio.
 * ✅ BLOC 5 : 100% Config-driven, Validation E.164, Aucun défaut.
 */

import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../structured-types";
import { Logger } from "../../infrastructure/logger";
import { z } from "zod";
import * as twilioService from "../../services/twilioService";

// Validation E.164 stricte
const phoneRegex = /^\+[1-9]\d{1,14}$/;

const smsConfigSchema = z.object({
  to: z.string().regex(phoneRegex, "Format de numéro E.164 invalide (ex: +33612345678)"),
  body: z.string().min(1, "Le message ne peut pas être vide"),
});

type SmsConfig = z.infer<typeof smsConfigSchema>;
interface SmsSentResult { sms_sent: boolean; sent_to: string; timestamp: string; }

export class SendSMSAction implements ActionHandler<SmsConfig, FinalExecutionContext, SmsSentResult> {
  name = 'send_sms';
  private logger = new Logger('SendSMSAction');

  async execute(context: FinalExecutionContext, config: SmsConfig): Promise<ActionResult<SmsSentResult>> {
    try {
      // Validation stricte de la config
      const validatedConfig = smsConfigSchema.parse(config);

      await twilioService.sendSms({ tenantId: context.tenant.id, to: validatedConfig.to, body: validatedConfig.body });

      this.logger.info(`SMS sent successfully via Twilio`, {
        to: validatedConfig.to,
        workflow_id: context.workflow.id,
        event_id: context.event.id,
      });


      
      const output = { 
        sms_sent: true,
        sent_to: validatedConfig.to,
        timestamp: new Date().toISOString()
      };

      return {
        success: true,
        data: output
      };

    } catch (error: unknown) {
      this.logger.error('SMS sending failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    try {
      smsConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }
}
