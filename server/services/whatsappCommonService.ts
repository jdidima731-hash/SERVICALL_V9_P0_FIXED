/**
 * WHATSAPP COMMON COMMUNICATION SERVICE
 * ─────────────────────────────────────────────────────────────
 * Service unifié pour l'envoi de messages WhatsApp via Meta ou Twilio.
 * Utilisé par l'Agent Client, l'Agent Owner et les services de notification.
 */

import { logger } from "../infrastructure/logger";

export interface WhatsAppConfig {
  wabaPhoneNumberId?: string;
  wabaAccessToken?: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioPhone?: string;
}

/**
 * Envoie un message WhatsApp en utilisant le meilleur provider disponible (Meta > Twilio)
 */
export async function sendWhatsAppUnified(
  to: string,
  message: string,
  config: WhatsAppConfig
): Promise<boolean> {
  // 1. Meta WhatsApp Business API (Priorité : moins cher, plus direct)
  if (config.wabaPhoneNumberId && config.wabaAccessToken) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${config.wabaPhoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.wabaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace(/^\+/, "").replace(/\s/g, ""),
            type: "text",
            text: { body: message },
          }),
        }
      );
      if (res.ok) {
        logger.info("[WhatsAppCommon] Message sent via Meta API", { to });
        return true;
      }
      const err = await res.text();
      logger.warn("[WhatsAppCommon] Meta API error", { err, status: res.status });
    } catch (err: any) {
      logger.error("[WhatsAppCommon] Meta API exception", { err });
    }
  }

  // 2. Twilio WhatsApp (Fallback)
  if (config.twilioSid && config.twilioToken && config.twilioPhone) {
    try {
      const twilio = await import("twilio");
      const client = (twilio as unknown).default(config.twilioSid, config.twilioToken);
      await (client as unknown).messages.create({
        from: `whatsapp:${config.twilioPhone}`,
        to: `whatsapp:${to}`,
        body: message,
      });
      logger.info("[WhatsAppCommon] Message sent via Twilio", { to });
      return true;
    } catch (err: any) {
      logger.error("[WhatsAppCommon] Twilio exception", { err });
    }
  }

  logger.warn("[WhatsAppCommon] No provider configured for sending", { to });
  return false;
}
