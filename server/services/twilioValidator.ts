/**
 * BLOC 3 : Validation Twilio Credentials & Signatures
 */

import { logger } from "../infrastructure/logger";
import twilio from "twilio";
import { Request } from "express";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

export class TwilioValidator {
  static validateConfiguration(config: TwilioConfig): void {
    const errors: string[] = [];

    if (!config.accountSid || config.accountSid.startsWith("ACtest")) {
      errors.push("TWILIO_ACCOUNT_SID is missing or invalid.");
    }

    if (!config.authToken || config.authToken.includes("placeholder")) {
      errors.push("TWILIO_AUTH_TOKEN is missing or invalid.");
    }

    if (errors.length > 0) {
      logger.warn("[Twilio] Configuration validation failed (Twilio is optional)", { errors });
    }
  }

  /**
   * Valide la signature Twilio pour garantir que la requête vient bien de Twilio
   */
  static validateSignature(req: Request): boolean {
    const authToken = process.env['TWILIO_AUTH_TOKEN'];
    if (!authToken) {
      logger.error("[Twilio] AuthToken missing for signature validation");
      return false;
    }

    const signature = req.headers["x-twilio-signature"] as string;
    if (!signature) {
      logger.warn("[Twilio] Missing X-Twilio-Signature header");
      return false;
    }

    // L'URL complète est nécessaire pour la validation
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["host"];
    const url = `${protocol}://${host}${req.originalUrl}`;
    
    // DURCI: S'assurer que les paramètres sont bien ceux attendus par Twilio (triés si nécessaire par le SDK)
    const params = req.body || {};

    const isValid = twilio.validateRequest(authToken, signature, url, params);

    if (!isValid) {
      logger.warn("[Twilio] Invalid signature detected", { url, signature });
    }

    return isValid;
  }

  static validatePhoneNumber(phoneNumber: string): boolean {
    return /^\+\d{10,15}$/.test(phoneNumber);
  }

  static validateCallSid(callSid: string): boolean {
    return /^CA[a-f0-9]{32}$/.test(callSid);
  }
}
