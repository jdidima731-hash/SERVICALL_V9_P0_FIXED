/**
 * COMMUNICATION SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour la gestion des communications sortantes et entrantes.
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 */

import { logger } from "../infrastructure/logger";
import { handleIncomingWhatsAppMessage, parseMetaWebhookMessage, type WhatsAppMessage } from "./whatsappAIService";
import { sendWhatsAppMessage } from "./twilioService";

export class CommunicationService {
  /**
   * Gère un message WhatsApp entrant
   */
  static async handleIncomingWhatsApp(tenantId: number, input: {
    message: WhatsAppMessage;
    tenantName?: string;
    wabaPhoneNumberId?: string;
    wabaAccessToken?: string;
    twilioSid?: string;
    twilioToken?: string;
    twilioPhone?: string;
  }) {
    return await handleIncomingWhatsAppMessage(
      input.message,
      tenantId,
      input.tenantName ?? 'Servicall',
      {
        wabaPhoneNumberId: input.wabaPhoneNumberId,
        wabaAccessToken: input.wabaAccessToken,
        twilioSid: input.twilioSid,
        twilioToken: input.twilioToken,
        twilioPhone: input.twilioPhone,
      }
    );
  }

  /**
   * Envoie un message WhatsApp sortant
   */
  static async sendWhatsApp(to: string, body: string) {
    const result = await sendWhatsAppMessage({ to, body });
    logger.info('[CommunicationService] WhatsApp message sent', { to });
    return { success: true, sid: (result as unknown)?.sid };
  }

  /**
   * Parse un payload de webhook Meta pour le débogage
   */
  static parseMetaWebhook(payload: unknown) {
    return parseMetaWebhookMessage(payload);
  }
}
