/**
 * SEND EMAIL ACTION
 * Envoie un email via le service d'emailing (Resend).
 */

import type { ActionHandler, ActionResult, FinalExecutionContext } from "../../types";
import { logger } from "../../../infrastructure/logger";
import { z } from "zod";

const emailConfigSchema = z.object({
  to: z.string().email("Format email invalide"),
  subject: z.string().min(1, "Le sujet est obligatoire"),
  body: z.string().min(1, "Le corps du message est obligatoire"),
});

type EmailConfig = z.infer<typeof emailConfigSchema>;

interface EmailSentResult { 
  to: string; 
  subject: string; 
  body: string; 
  tenant_id: number; 
  sent_at: Date; 
  status: string; 
  metadata: Record<string, unknown>; 
}

export class SendEmailAction implements ActionHandler<EmailConfig, FinalExecutionContext, EmailSentResult> {
  name = 'send_email';
  private resendApiKey: string | undefined;

  constructor() {
    this.resendApiKey = process.env['RESEND_API_KEY'];
  }

  async execute(context: FinalExecutionContext, config: EmailConfig): Promise<ActionResult<EmailSentResult>> {
    try {
      // Validation stricte de la config
      const validatedConfig = emailConfigSchema.parse(config);

      // Essayer d'envoyer via Resend si la clé API est disponible
      if (this.resendApiKey) {
        return await this.sendViaResend(validatedConfig, context);
      }

      // Erreur explicite si aucune clé n'est configurée
      logger.error('[SendEmailAction] Resend API key not configured, email cannot be sent');
      throw new Error("Configuration email manquante (RESEND_API_KEY non définie)");

    } catch (error: unknown) {
      logger.error('[SendEmailAction] Failed to send email', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Envoie un email via Resend
   */
  private async sendViaResend(
    config: EmailConfig,
    context: FinalExecutionContext
  ): Promise<ActionResult<EmailSentResult>> {
    try {
      // Importer dynamiquement Resend
      const { Resend } = await import('resend');
      
      const resend = new Resend(this.resendApiKey);

      const fromEmail: string = process.env['RESEND_FROM_EMAIL'] || 'noreply@servicall.io';
      
      const response = await resend.emails.send({
        from: fromEmail,
        to: config.to,
        subject: config.subject,
        html: config.body,
      });

      if (response.error) {
        logger.error('[SendEmailAction] Resend API error', { error: response.error });
        return {
          success: false,
          error: `Resend error: ${response.error.message}`
        };
      }

      const emailData: EmailSentResult = {
        to: config.to,
        subject: config.subject,
        body: config.body,
        tenant_id: context.tenant.id,
        sent_at: new Date(),
        status: 'sent',
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          provider: 'resend',
          resend_id: response.data?.id
        }
      };

      logger.info('[SendEmailAction] Email sent via Resend', { 
        to: emailData.to,
        subject: emailData.subject,
        tenant: context.tenant.id,
        resend_id: response.data?.id
      });

      return {
        success: true,
        data: emailData
      };
    } catch (error: unknown) {
      logger.error('[SendEmailAction] Resend send failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email via Resend'
      };
    }
  }

  validate(config: Record<string, unknown>): boolean {
    const result = emailConfigSchema.safeParse(config);
    return result.success;
  }
}
