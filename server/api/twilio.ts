/**
 * TWILIO API ROUTER — SERVICALL V8
 * ✅ FIX SÉCURITÉ : Résolution dynamique du tenant
 * ✅ FIX V8 : Typage strict sans contournement TypeScript
 */

import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { getDbInstance } from "../db";
import { rgpdConsents } from "../../drizzle/schema";
import { TwilioValidator } from "../services/twilioValidator";
import { webhookLimiter } from "../middleware/rateLimit";
import { logger } from "../infrastructure/logger";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";
import {
  TwilioTenantResolver,
  handleCallStatusUpdate,
  handleIncomingCall,
} from "../services/twilioService";
import { handleGlobalIncomingCall } from "../services/liveListeningService";
import { buildTransferTwiML, resolveTransfer } from "../services/smartTransferService";

const router = Router();

const callSidSchema = z.string().regex(/^CA[a-zA-Z0-9]{32}$/u, "Invalid CallSid");
const recordingSidSchema = z.string().regex(/^RE[a-zA-Z0-9]{32}$/u, "Invalid RecordingSid");
const phoneSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/u, "Invalid phone number");
const booleanLikeSchema = z.preprocess((value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return value;
}, z.boolean());

const integerLikeSchema = z.preprocess((value: unknown) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && /^\d+$/u.test(value)) {
    return Number.parseInt(value, 10);
  }

  return value;
}, z.number().int().positive());

const stringFromQuerySchema = z.preprocess((value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return value;
}, z.string());

const consentWebhookSchema = z.object({
  prospectId: integerLikeSchema,
  callSid: callSidSchema.optional(),
  consentGiven: booleanLikeSchema,
  recordingConsent: booleanLikeSchema.optional(),
  aiDisclosure: booleanLikeSchema.optional(),
  To: z.string().optional(),
});

const recordingWebhookSchema = z.object({
  CallSid: callSidSchema,
  RecordingSid: recordingSidSchema,
  RecordingUrl: z.string().min(1).optional(),
  RecordingStatus: z.string().min(1).optional(),
});

const callStatusWebhookSchema = z.object({
  CallSid: callSidSchema,
  CallStatus: z.string().min(1),
  From: z.string().optional(),
  To: z.string().optional(),
  Duration: z.union([z.string(), z.number()]).optional(),
  RecordingUrl: z.string().optional(),
});

const incomingCallWebhookSchema = z.object({
  CallSid: callSidSchema,
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().min(1),
});

const transferQuerySchema = z.object({
  agentPhone: stringFromQuerySchema.pipe(phoneSchema),
  prospectName: stringFromQuerySchema.optional(),
  callSid: stringFromQuerySchema.optional(),
});

const transferFallbackSchema = z.object({
  DialCallStatus: z.string().min(1),
  CallSid: callSidSchema,
  From: z.string().optional(),
  To: z.string().optional(),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown, routeName: string): T {
  const parsed = schema.safeParse(body);
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

function parseQuery<T>(schema: z.ZodType<T>, query: unknown, routeName: string): T {
  const parsed = schema.safeParse(query);
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

function sendXml(res: Response, statusCode: number, xml: string): Response {
  res.type("text/xml");
  return res.status(statusCode).send(xml);
}

function buildTransferFallbackTwiml(callbackDelayMinutes: number): string {
  return [
    "<Response>",
    `<Say voice=\"alice\" language=\"fr-FR\">Aucun agent n'est disponible immédiatement. Un rappel est planifié sous ${callbackDelayMinutes} minutes.</Say>`,
    "<Hangup/>",
    "</Response>",
  ].join("");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error: unknown) {
    logger.warn("[Twilio] Failed to decode query parameter", {
      error: error instanceof Error ? error.message : String(error),
    });
    return value;
  }
}

// ─── Résolution dynamique du tenant depuis le numéro Twilio ────────

export async function resolveTenantIdFromTwilioNumber(toNumber: string | undefined): Promise<number | null> {
  if (!toNumber) {
    return null;
  }

  try {
    return await TwilioTenantResolver.resolveByCalledNumber(toNumber);
  } catch (error: unknown) {
    logger.error("[Twilio] resolveTenantId failed", {
      error: error instanceof Error ? error.message : String(error),
      toNumber,
    });
    return null;
  }
}

// ─── Middleware de protection Twilio ─────────────────────────────────────────

const twilioAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (process.env["NODE_ENV"] === "test") {
    next();
    return;
  }

  if (!TwilioValidator.validateSignature(req)) {
    res.status(403).json({ error: "Forbidden: Invalid Twilio Signature" });
    return;
  }

  next();
};

router.use(webhookLimiter);
router.use(twilioAuth);

// ─── Webhook consentement RGPD ────────────────────────────────────────────────

router.post("/consent", async (req: Request, res: Response) => {
  try {
    const payload = parseBody(consentWebhookSchema, req.body, "twilio consent webhook");
    const eventId = payload.callSid ?? `consent-${payload.prospectId}`;
    const isNew = await IdempotencyService.checkAndSet(eventId, "twilio");
    if (!isNew) {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }

    const db = getDbInstance();
    const resolvedTenantId = await resolveTenantIdFromTwilioNumber(payload.To);

    if (!resolvedTenantId) {
      logger.warn("[RGPD] Could not resolve tenant from Twilio number", { To: payload.To });
      res.status(422).json({ success: false, error: "Tenant not found for this number" });
      return;
    }

    await db.insert(rgpdConsents).values({
      tenantId: resolvedTenantId,
      prospectId: payload.prospectId,
      consentType: "call_recording",
      granted: payload.consentGiven,
      grantedAt: new Date(),
      metadata: {
        callSid: payload.callSid ?? null,
        recordingConsent: payload.recordingConsent ?? false,
        aiDisclosure: payload.aiDisclosure ?? false,
      },
    });

    logger.info("[RGPD] Consent recorded", {
      prospectId: payload.prospectId,
      tenantId: resolvedTenantId,
      callSid: payload.callSid,
    });
    res.status(200).json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues.map((issue: z.ZodIssue) => issue.message).join("; "),
      });
      return;
    }

    logger.error("[RGPD] Error recording consent", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─── Webhook enregistrement ───────────────────────────────────────────────────

router.post("/recording", async (req: Request, res: Response) => {
  try {
    const payload = parseBody(recordingWebhookSchema, req.body, "twilio recording webhook");
    const isNew = await IdempotencyService.checkAndSet(payload.RecordingSid, "twilio-recording");
    if (!isNew) {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }

    logger.info("[Twilio] Recording webhook received", {
      callSid: payload.CallSid,
      recordingSid: payload.RecordingSid,
      recordingStatus: payload.RecordingStatus,
      recordingUrl: payload.RecordingUrl,
    });

    res.status(200).json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues.map((issue: z.ZodIssue) => issue.message).join("; "),
      });
      return;
    }

    logger.error("[Twilio] Error processing recording webhook", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false });
  }
});

// ─── Webhook statut d'appel ───────────────────────────────────────────────────

router.post("/call-status", async (req: Request, res: Response) => {
  try {
    const payload = parseBody(callStatusWebhookSchema, req.body, "twilio call-status webhook");
    const isNew = await IdempotencyService.checkAndSet(`${payload.CallSid}-${payload.CallStatus}`, "twilio-status");
    if (!isNew) {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }

    await handleCallStatusUpdate(payload);
    res.status(200).json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues.map((issue: z.ZodIssue) => issue.message).join("; "),
      });
      return;
    }

    logger.error("[Twilio] Error processing call status", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false });
  }
});

// ─── Webhook appels entrants ──────────────────────────────────────────────────

router.post("/incoming-call", async (req: Request, res: Response) => {
  try {
    const payload = parseBody(incomingCallWebhookSchema, req.body, "twilio incoming-call webhook");

    void handleGlobalIncomingCall({
      callSid: payload.CallSid,
      from: payload.From,
      to: payload.To,
      status: payload.CallStatus,
    }).catch((error: unknown) => {
      logger.error("[Twilio] Global incoming call capture failed", {
        error: error instanceof Error ? error.message : String(error),
        callSid: payload.CallSid,
      });
    });

    const twimlResponse = await handleIncomingCall({
      callSid: payload.CallSid,
      from: payload.From,
      to: payload.To,
      status: payload.CallStatus,
    });

    sendXml(res, 200, twimlResponse);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      sendXml(res, 400, '<Response><Say>Requête invalide</Say><Hangup/></Response>');
      return;
    }

    logger.error("[Twilio] Error processing incoming call", {
      error: error instanceof Error ? error.message : String(error),
    });
    sendXml(res, 500, '<Response><Say>Erreur système</Say><Hangup/></Response>');
  }
});

// ─── Transfer vers agent humain (déclenché par l'IA) ─────────────────────────

router.get("/do-transfer", async (req: Request, res: Response) => {
  try {
    const query = parseQuery(transferQuerySchema, req.query, "twilio do-transfer query");
    const summary = query.prospectName ? safeDecodeURIComponent(query.prospectName) : "";
    const twiml = buildTransferTwiML({
      agentPhone: query.agentPhone,
      prospectName: summary || "Prospect",
      trigger: "caller_request",
      summary: query.callSid ?? "Appel entrant",
    });

    logger.info("[Twilio] do-transfer TwiML sent", {
      agentPhone: query.agentPhone,
      callSid: query.callSid,
    });
    sendXml(res, 200, twiml);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      sendXml(res, 400, '<Response><Say voice="alice" language="fr-FR">Paramètres de transfert invalides.</Say><Hangup/></Response>');
      return;
    }

    logger.error("[Twilio] Error in do-transfer", {
      error: error instanceof Error ? error.message : String(error),
    });
    sendXml(res, 500, '<Response><Say voice="alice" language="fr-FR">Erreur lors du transfert.</Say><Hangup/></Response>');
  }
});

// ─── Fallback transfert (agent ne répond pas) ─────────────────────────────────

router.post("/transfer-fallback", async (req: Request, res: Response) => {
  try {
    const payload = parseBody(transferFallbackSchema, req.body, "twilio transfer-fallback webhook");

    logger.info("[Twilio] Transfer fallback triggered", {
      dialCallStatus: payload.DialCallStatus,
      callSid: payload.CallSid,
    });

    if (payload.DialCallStatus === "no-answer" || payload.DialCallStatus === "busy" || payload.DialCallStatus === "failed") {
      const tenantId = await resolveTenantIdFromTwilioNumber(payload.To);
      if (!tenantId) {
        logger.error("[Twilio] Transfer fallback: Could not resolve tenant from To number", {
          to: payload.To,
          callSid: payload.CallSid,
        });
        sendXml(res, 200, '<Response><Hangup/></Response>');
        return;
      }

      void resolveTransfer({
        tenantId,
        callSid: payload.CallSid,
        prospectPhone: payload.From ?? "",
        trigger: "caller_request",
        conversationSummary: "Appelant a demandé un transfert humain mais l'agent n'était pas disponible.",
        preferredCallbackDelayMinutes: 30,
      }).catch((error: unknown) => {
        logger.error("[Twilio] Fallback callback scheduling failed", {
          error: error instanceof Error ? error.message : String(error),
          tenantId,
          callSid: payload.CallSid,
        });
      });

      const twiml = buildTransferFallbackTwiml(30);
      sendXml(res, 200, twiml);
      return;
    }

    sendXml(res, 200, '<Response><Hangup/></Response>');
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      sendXml(res, 400, '<Response><Say>Requête invalide</Say><Hangup/></Response>');
      return;
    }

    logger.error("[Twilio] Error in transfer-fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    sendXml(res, 500, '<Response><Hangup/></Response>');
  }
});

export default router;
