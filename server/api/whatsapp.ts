/**
 * WHATSAPP WEBHOOK ROUTER
 * ─────────────────────────────────────────────────────────────
 * Reçoit les messages WhatsApp entrants (Meta Business API ou Twilio)
 * et déclenche le dialogue IA.
 *
 * FIX CRIT-3: Suppression de l'injection SQL par interpolation de chaîne
 *   Avant: WHERE phone_number = '${toNumber.replace(/'/g, "''")}'
 *          Interpolation directe dans SQL brut → injection possible.
 *   Après: Requête Drizzle ORM paramétrée sur le champ settings JSON.
 *          Aucune interpolation de données utilisateur dans le SQL.
 *
 * Endpoints :
 *  GET  /api/whatsapp/webhook      → Vérification Meta (challenge)
 *  POST /api/whatsapp/webhook      → Messages entrants Meta
 *  POST /api/whatsapp/twilio       → Messages entrants Twilio
 *  GET  /api/whatsapp/status       → Statut de la configuration
 */

import { createHmac, timingSafeEqual } from "crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { tenants } from "../../drizzle/schema";
import { getDbInstance } from "../db";
import { logger } from "../infrastructure/logger";
import {
  handleIncomingWhatsAppMessage,
  parseMetaWebhookMessage,
  parseTwilioWebhookMessage,
} from "../services/whatsappAIService";
import {
  handleOwnerAgentMessage,
  isOwnerPhone,
} from "../services/whatsappOwnerAgentService";
import {
  sendWhatsAppUnified,
  type WhatsAppConfig,
} from "../services/whatsappCommonService";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";

const router = Router();

const genericBodySchema = z.record(z.unknown());
const phoneRegex = /^\+?[1-9]\d{7,14}$/u;
const phoneSchema = z.string().regex(phoneRegex, "Invalid phone number format");
const queryStringSchema = z.preprocess((value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return value;
}, z.string());

const webhookVerificationQuerySchema = z.object({
  "hub.mode": queryStringSchema.optional(),
  "hub.verify_token": queryStringSchema.optional(),
  "hub.challenge": queryStringSchema.optional(),
});

const tenantSettingsRecordSchema = z.record(z.unknown());

type TenantSettingsRecord = z.infer<typeof tenantSettingsRecordSchema>;

type TenantWhatsAppConfig = {
  tenantId: number;
  tenantName: string;
  settings: TenantSettingsRecord | null;
  config: WhatsAppConfig;
} | null;

function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s\-().]/gu, "");
}

function parseGenericBody(body: unknown, routeName: string): Record<string, unknown> {
  const parsed = genericBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new z.ZodError(
      parsed.error.issues.map((issue: z.ZodIssue) => ({
        ...issue,
        message: `${routeName}: ${issue.message}`,
      })),
    );
  }

  return parsed.data;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}

function getMetaAppSecret(): string | undefined {
  return process.env["META_APP_SECRET"] ?? process.env["WABA_APP_SECRET"];
}

function getWebhookVerifyToken(): string | undefined {
  return process.env["META_WEBHOOK_VERIFY_TOKEN"] ?? process.env["WABA_WEBHOOK_VERIFY_TOKEN"];
}

// ─────────────────────────────────────────────
// FIX CRIT-3: Résolution du tenant — paramétré, sans interpolation SQL
// ─────────────────────────────────────────────

async function resolveTenantFromWhatsApp(toNumber: string): Promise<TenantWhatsAppConfig> {
  const sanitizedNumber = normalizePhoneNumber(toNumber);
  const parsedNumber = phoneSchema.safeParse(sanitizedNumber);
  if (!parsedNumber.success) {
    logger.warn("[WhatsApp] Invalid phone number format rejected", { toNumber });
    return null;
  }

  try {
    const db = getDbInstance();
    const normalizedNumber = parsedNumber.data.startsWith("+") ? parsedNumber.data : `+${parsedNumber.data}`;
    const rawNumber = normalizedNumber.replace(/^\+/u, "");

    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(
        sql`(
          ${tenants.settings}->>'twilioPhone' = ${parsedNumber.data}
          OR ${tenants.settings}->>'twilioPhone' = ${normalizedNumber}
          OR ${tenants.settings}->>'twilioPhone' = ${rawNumber}
          OR ${tenants.settings}->>'wabaPhoneNumber' = ${parsedNumber.data}
          OR ${tenants.settings}->>'wabaPhoneNumber' = ${normalizedNumber}
          OR ${tenants.settings}->>'wabaPhoneNumber' = ${rawNumber}
          OR ${tenants.settings}->>'wabaPhoneNumberId' = ${parsedNumber.data}
          OR ${tenants.settings}->>'wabaPhoneNumberId' = ${normalizedNumber}
          OR ${tenants.settings}->>'wabaPhoneNumberId' = ${rawNumber}
        )`,
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      logger.warn("[WhatsApp] No tenant found for WhatsApp number", { toNumber: parsedNumber.data });
      return null;
    }

    const parsedSettings = tenantSettingsRecordSchema.safeParse(row.settings ?? null);
    const tenantSettings = parsedSettings.success ? parsedSettings.data : null;

    return {
      tenantId: row.id,
      tenantName: row.name,
      settings: tenantSettings,
      config: {
        wabaPhoneNumberId:
          typeof tenantSettings?.wabaPhoneNumberId === "string"
            ? tenantSettings.wabaPhoneNumberId
            : process.env["WABA_PHONE_NUMBER_ID"],
        wabaAccessToken:
          typeof tenantSettings?.wabaAccessToken === "string"
            ? tenantSettings.wabaAccessToken
            : process.env["WABA_ACCESS_TOKEN"],
        twilioSid:
          typeof tenantSettings?.twilioAccountSid === "string"
            ? tenantSettings.twilioAccountSid
            : process.env["TWILIO_ACCOUNT_SID"],
        twilioToken:
          typeof tenantSettings?.twilioAuthToken === "string"
            ? tenantSettings.twilioAuthToken
            : process.env["TWILIO_AUTH_TOKEN"],
        twilioPhone:
          typeof tenantSettings?.twilioPhone === "string"
            ? tenantSettings.twilioPhone
            : process.env["TWILIO_PHONE_NUMBER"],
      },
    };
  } catch (error: unknown) {
    logger.error("[WhatsApp] Failed to resolve tenant", {
      error: error instanceof Error ? error.message : String(error),
      toNumber,
    });
    return null;
  }
}

// ─────────────────────────────────────────────
// ✅ FIX SÉCURITÉ: Vérification signature X-Hub-Signature-256 (Meta)
// Sans ça, n'importe qui peut envoyer de faux webhooks Meta
// ─────────────────────────────────────────────

function verifyMetaSignature(req: Request): boolean {
  const appSecret = getMetaAppSecret();
  if (!appSecret) {
    if (process.env["NODE_ENV"] === "production") {
      logger.error("[WhatsApp] META_APP_SECRET absent en production — webhook rejeté");
      return false;
    }

    logger.warn("[WhatsApp] META_APP_SECRET non configuré — signature webhook non vérifiée hors production");
    return true;
  }

  const signature = getHeaderValue(req.headers["x-hub-signature-256"]);
  if (!signature) {
    logger.warn("[WhatsApp] Webhook Meta rejeté : header X-Hub-Signature-256 absent");
    return false;
  }

  const rawBody: Buffer | undefined = req.rawBody;
  const bodyToSign = rawBody ?? Buffer.from(JSON.stringify(req.body));
  const expected = `sha256=${createHmac("sha256", appSecret).update(bodyToSign).digest("hex")}`;

  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error: unknown) {
    logger.warn("[WhatsApp] Signature comparison failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ─────────────────────────────────────────────
// GET /api/whatsapp/webhook — Vérification Meta
// ─────────────────────────────────────────────

router.get("/webhook", (req: Request, res: Response) => {
  try {
    const query = webhookVerificationQuerySchema.parse(req.query);
    const verifyToken = getWebhookVerifyToken();

    if (!verifyToken) {
      if (process.env["NODE_ENV"] === "production") {
        logger.error("[WhatsApp] META_WEBHOOK_VERIFY_TOKEN absent en production");
        res.sendStatus(500);
        return;
      }

      logger.warn("[WhatsApp] META_WEBHOOK_VERIFY_TOKEN absent — fallback développement utilisé");
    }

    const expectedToken = verifyToken ?? "servicall_verify_token";

    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === expectedToken) {
      logger.info("[WhatsApp] Meta webhook verification OK");
      res.status(200).send(query["hub.challenge"] ?? "");
      return;
    }

    logger.warn("[WhatsApp] Meta webhook verification failed", {
      mode: query["hub.mode"],
    });
    res.sendStatus(403);
  } catch (error: unknown) {
    logger.warn("[WhatsApp] Invalid webhook verification query", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.sendStatus(400);
  }
});

// ─────────────────────────────────────────────
// POST /api/whatsapp/webhook — Messages Meta entrants
// ─────────────────────────────────────────────

router.post("/webhook", async (req: Request, res: Response) => {
  if (!verifyMetaSignature(req)) {
    logger.warn("[WhatsApp] Webhook Meta rejeté : signature invalide");
    res.sendStatus(403);
    return;
  }

  res.sendStatus(200);

  try {
    const body = parseGenericBody(req.body, "whatsapp meta webhook");
    const message = parseMetaWebhookMessage(body);

    if (!message || !message.body) {
      return;
    }

    const isNew = await IdempotencyService.checkAndSet(message.messageId, "whatsapp-meta");
    if (!isNew) {
      return;
    }

    const tenantConfig = await resolveTenantFromWhatsApp(message.to ?? "");
    if (!tenantConfig) {
      logger.warn("[WhatsApp] Meta message rejected: tenant not resolved", { to: message.to });
      return;
    }

    logger.info("[WhatsApp] Processing Meta message", {
      from: message.from,
      tenantId: tenantConfig.tenantId,
    });

    if (await isOwnerPhone(message.from, tenantConfig.settings)) {
      logger.info("[WhatsApp] Owner message detected — routing to OwnerAgent", {
        tenantId: tenantConfig.tenantId,
      });

      const result = await handleOwnerAgentMessage(
        { from: message.from, body: message.body, timestamp: message.timestamp },
        tenantConfig.tenantId,
        tenantConfig.tenantName,
      );

      if (result.replied && result.response) {
        await sendWhatsAppUnified(message.from, result.response, tenantConfig.config);
      }
      return;
    }

    await handleIncomingWhatsAppMessage(
      message,
      tenantConfig.tenantId,
      tenantConfig.tenantName,
      tenantConfig.config,
    );
  } catch (error: unknown) {
    logger.error("[WhatsApp] Error processing Meta webhook", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─────────────────────────────────────────────
// POST /api/whatsapp/twilio — Messages Twilio entrants
// ─────────────────────────────────────────────

router.post("/twilio", async (req: Request, res: Response) => {
  res.sendStatus(200);

  try {
    const body = parseGenericBody(req.body, "whatsapp twilio webhook");
    const stringBody: Record<string, string> = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")]),
    );
    const message = parseTwilioWebhookMessage(stringBody);

    if (!message || !message.body) {
      return;
    }

    const isNew = await IdempotencyService.checkAndSet(message.messageId, "whatsapp-twilio");
    if (!isNew) {
      return;
    }

    const tenantConfig = await resolveTenantFromWhatsApp(message.to ?? "");
    if (!tenantConfig) {
      logger.warn("[WhatsApp] Twilio message rejected: tenant not resolved", { to: message.to });
      return;
    }

    logger.info("[WhatsApp] Processing Twilio message", {
      from: message.from,
      tenantId: tenantConfig.tenantId,
    });

    if (await isOwnerPhone(message.from, tenantConfig.settings)) {
      logger.info("[WhatsApp] Owner message (Twilio) — routing to OwnerAgent", {
        tenantId: tenantConfig.tenantId,
      });

      const result = await handleOwnerAgentMessage(
        { from: message.from, body: message.body, timestamp: message.timestamp },
        tenantConfig.tenantId,
        tenantConfig.tenantName,
      );

      if (result.replied && result.response) {
        await sendWhatsAppUnified(message.from, result.response, tenantConfig.config);
      }
      return;
    }

    await handleIncomingWhatsAppMessage(
      message,
      tenantConfig.tenantId,
      tenantConfig.tenantName,
      tenantConfig.config,
    );
  } catch (error: unknown) {
    logger.error("[WhatsApp] Error processing Twilio webhook", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// ─────────────────────────────────────────────
// GET /api/whatsapp/status — Statut config
// ─────────────────────────────────────────────

router.get("/status", (_req: Request, res: Response) => {
  const hasWaba = Boolean(process.env["WABA_PHONE_NUMBER_ID"] && process.env["WABA_ACCESS_TOKEN"]);
  const hasTwilio = Boolean(
    process.env["TWILIO_ACCOUNT_SID"] &&
      process.env["TWILIO_AUTH_TOKEN"] &&
      process.env["TWILIO_PHONE_NUMBER"],
  );

  res.json({
    status: "ok",
    providers: {
      meta: hasWaba ? "configured" : "not_configured",
      twilio: hasTwilio ? "configured" : "not_configured",
    },
  });
});

export default router;
