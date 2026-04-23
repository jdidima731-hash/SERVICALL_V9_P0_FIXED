/**
 * Email Service - Envoi d'emails
 */
import nodemailer from "nodemailer";
import { logger } from '../core/logger/index';

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env['EMAIL_USER'] || "servicallc@gmail.com",
    pass: process.env["EMAIL_PASSWORD"] ?? "",
  },
});

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  logger.info(`[Email Service] Sending email to ${to}`);
  logger.info(`[Email Service] Subject: ${subject}`);

  try {
    // Si le mot de passe n'est pas configuré, on simule l'envoi
    if (!process.env['EMAIL_PASSWORD']) {
      logger.info(`[Email Service] EMAIL_PASSWORD not configured, simulating send`);
      logger.info(`[Email Service] Body: ${body}`);
      return Promise.resolve();
    }

    const info = await transporter.sendMail({
      from: `"Servicall CRM" <${process.env['EMAIL_USER'] || "servicallc@gmail.com"}>`,
      to,
      subject,
      text: body,
    });

    logger.info(`[Email Service] Email sent successfully: ${info.messageId}`);
  } catch (error: any) {
    logger.error(`[Email Service] Error sending email:`, error);
    // Ne pas faire échouer la requête si l'email échoue
    logger.info(`[Email Service] Continuing despite email error`);
  }
}
