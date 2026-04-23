import * as twilioService from "./twilioService";
import axios from "axios";
import { logger } from "../infrastructure/logger";
import { ResilienceService } from "./resilienceService";
import { addJob } from "./queueService";

/**
 * Notification Service - Envoi de confirmations par SMS et Email avec Résilience
 * ✅ BLOC 2: Envoi d'email asynchrone via BullMQ
 */

/**
 * Send appointment confirmation via SMS
 */
export async function sendAppointmentSMS(
  phoneNumber: string,
  appointment: {
    title: string;
    startTime: Date;
    location?: string;
  }
): Promise<boolean> {
  try {
    const dateStr = appointment.startTime.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `Confirmation Servicall : Votre rendez-vous "${appointment.title}" est prévu le ${dateStr}.${
      appointment.location ? ` Lieu : ${appointment.location}` : ""
    }`;

    if (process.env['MOCK_NOTIFICATIONS'] === "true") {
      logger.info(`[MOCK][SMS] To: ${phoneNumber}, Message: ${message}`);
      return true;
    }

    // Utilisation du twilioService qui a déjà sa propre résilience
    
    await twilioService.sendSms({ to: phoneNumber, body: message });
    return true;
  } catch (error: any) {
    logger.error("[Notification Service] Error sending SMS", error, { module: "TWILIO" });
    return false;
  }
}

/**
 * Send appointment confirmation via Email (Asynchrone via BullMQ)
 */
export async function sendAppointmentEmail(
  email: string,
  appointment: {
    title: string;
    startTime: Date;
    endTime: Date;
    description?: string;
    location?: string;
  },
  tenantId?: number
): Promise<boolean> {
  try {
    // ✅ AXE 3: Utilisation de la queue pour l'envoi d'email
    await addJob("email-campaigns", {
      type: "appointment-confirmation",
      to: email,
      tenantId,
      appointment: {
        ...appointment,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
      }
    });

    logger.info(`[Notification Service] Email queued for ${email}`);
    return true;
  } catch (error: any) {
    logger.error("[Notification Service] Failed to queue Email", error);
    return false;
  }
}

/**
 * Implémentation réelle de l'envoi SendGrid (appelée par le Worker)
 */
export async function sendEmailInternal(params: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    logger.warn("[Notification Service] SendGrid API Key missing");
    return;
  }

  const data = {
    personalizations: [{ to: [{ email: params.to }] }],
    from: { email: process.env['FROM_EMAIL'] || "no-reply@servicall.com", name: "Servicall CRM" },
    subject: params.subject,
    content: [{ type: "text/html", value: params.html }],
  };

  await ResilienceService.execute(
    async () => {
      await axios.post("https://api.sendgrid.com/v3/mail/send", data, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
    },
    {
      name: "SENDGRID_EMAIL_SEND",
      module: "SYSTEM",
      idempotencyKey: params.idempotencyKey
    }
  );
}

/**
 * Alias générique pour l'envoi d'email (Asynchrone)
 */
export async function sendEmail(params: { 
  to: string, 
  subject: string, 
  text: string, 
  html?: string, 
  tenantId?: number 
}): Promise<void> {
  await addJob("email-campaigns", {
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    tenantId: params.tenantId
  });
}