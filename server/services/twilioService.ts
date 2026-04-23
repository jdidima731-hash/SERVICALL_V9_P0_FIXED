import { z } from "zod";
import twilio from "twilio";
import { logger } from "../infrastructure/logger";
import { ENV } from "../_core/env";
import { getAPIKey } from "./byokService";
import type { CallInstance } from "twilio/lib/rest/api/v2010/account/call";
import type { MessageInstance } from "twilio/lib/rest/api/v2010/account/message";

/**
 * TWILIO SERVICE — GATEWAY CANONIQUE (BLOC 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Unification du transport Twilio (Voix, SMS, Conférence)
 * ✅ Support BYOK strict par tenant
 * ✅ Centralisation de la résolution des numéros
 * ✅ CORRECTION V8 : Typage strict et suppression des stubs non fonctionnels
 */

const accountSid = ENV.twilioAccountSid;
const authToken = ENV.twilioAuthToken;
const phoneNumber = ENV.twilioPhoneNumber;

const twilioAccountSidSchema = z.string().regex(/^AC[a-zA-Z0-9]{32}$/u, "Invalid Twilio Account SID");
const twilioPhoneSchema = z.string().regex(/^\+?[1-9]\d{7,14}$/u, "Invalid phone number format");
const callSidSchema = z.string().regex(/^CA[a-zA-Z0-9]{32}$/u, "Invalid CallSid format");
const twilioSettingsSchema = z
  .object({
    allowPlatformFallback: z.boolean().optional(),
  })
  .passthrough();

const outboundCallSchema = z.object({
  tenantId: z.number().int().positive(),
  to: twilioPhoneSchema,
  url: z.string().url(),
  statusCallback: z.string().url().optional(),
});

const sendSmsSchema = z.object({
  tenantId: z.number().int().positive(),
  to: z.string().min(1),
  body: z.string().min(1),
});

const updateCallSchema = z
  .object({
    tenantId: z.number().int().positive(),
    callSid: callSidSchema,
    twiml: z.string().min(1).optional(),
    url: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.twiml && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "twiml or url is required to update a call",
      });
    }
  });

const transferCallSchema = z.object({
  callSid: callSidSchema,
  to: z.string().min(1),
  tenantId: z.number().int().positive().optional(),
});

const callStatusUpdateSchema = z.object({
  CallSid: callSidSchema,
  CallStatus: z.string().min(1),
  From: z.string().optional(),
  To: z.string().optional(),
  Duration: z.union([z.string(), z.number()]).optional(),
  RecordingUrl: z.string().optional(),
});

const incomingCallSchema = z.object({
  callSid: callSidSchema,
  from: z.string().min(1),
  to: z.string().min(1),
  status: z.string().min(1),
});

export interface QueuedCallResult {
  jobId: string | number;
  status: string;
  sid?: string;
}

export interface CallSidResult {
  sid: string;
  status: string;
}

type TwilioClient = ReturnType<typeof twilio>;
type TwilioCallsResource = TwilioClient["calls"];
type TwilioCallContext = ReturnType<TwilioCallsResource>;
type TwilioCallCreateParams = Parameters<TwilioCallsResource["create"]>[0];
type TwilioCallUpdateParams = Parameters<TwilioCallContext["update"]>[0];
type TwilioMessageCreateParams = Parameters<TwilioClient["messages"]["create"]>[0];

let globalClient: TwilioClient | null = null;

function ensureTwilioCredentials(params: {
  accountSid: string | undefined;
  authToken: string | undefined;
  source: string;
}): { accountSid: string; authToken: string } {
  const parsedSid = twilioAccountSidSchema.safeParse(params.accountSid);
  if (!parsedSid.success) {
    throw new Error(`[Twilio] ${params.source} Account SID is missing or invalid`);
  }

  if (!params.authToken || params.authToken.trim().length === 0) {
    throw new Error(`[Twilio] ${params.source} Auth Token is missing`);
  }

  return {
    accountSid: parsedSid.data,
    authToken: params.authToken,
  };
}

function ensurePhoneNumberConfigured(value: string | undefined, source: string): string {
  const parsedPhone = twilioPhoneSchema.safeParse(value);
  if (!parsedPhone.success) {
    throw new Error(`[Twilio] ${source} phone number is missing or invalid`);
  }

  return parsedPhone.data.startsWith("+") ? parsedPhone.data : `+${parsedPhone.data}`;
}

function createTwilioClient(accountSidValue: string, authTokenValue: string, source: string): TwilioClient {
  try {
    return twilio(accountSidValue, authTokenValue);
  } catch (error: unknown) {
    logger.error(`[Twilio] Failed to initialize ${source} client`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`[Twilio] ${source} client initialization failed`);
  }
}

function parseWithSchema<T>(schema: z.ZodSchema<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`[Twilio] Invalid ${label}: ${parsed.error.message}`);
  }
  return parsed.data;
}

function buildDialTransferTwiml(to: string): string {
  const parsedPhone = twilioPhoneSchema.safeParse(to);
  if (!parsedPhone.success) {
    throw new Error("[Twilio] Transfer target must be a valid URL or E.164 phone number");
  }

  const voiceResponse = new twilio.twiml.VoiceResponse();
  voiceResponse.dial(parsedPhone.data.startsWith("+") ? parsedPhone.data : `+${parsedPhone.data}`);
  return voiceResponse.toString();
}

/**
 * Récupère le client Twilio (BYOK ou Global)
 */
export async function getTwilioClient(tenantId?: number): Promise<TwilioClient> {
  if (tenantId !== undefined) {
    const tSid = await getAPIKey(tenantId, "twilio_sid");
    const tToken = await getAPIKey(tenantId, "twilio_token");

    if (tSid && tToken) {
      const credentials = ensureTwilioCredentials({
        accountSid: tSid,
        authToken: tToken,
        source: `tenant ${tenantId} BYOK`,
      });

      return createTwilioClient(credentials.accountSid, credentials.authToken, `tenant ${tenantId} BYOK`);
    }

    const allowPlatformFallback = await isPlatformFallbackAllowed(tenantId);
    if (!allowPlatformFallback) {
      throw new Error(`[Twilio] Credentials missing for tenant ${tenantId} (BYOK strict)`);
    }
  }

  if (!globalClient) {
    const credentials = ensureTwilioCredentials({
      accountSid,
      authToken,
      source: "platform",
    });
    globalClient = createTwilioClient(credentials.accountSid, credentials.authToken, "platform");
  }

  return globalClient;
}

/**
 * Récupère le numéro de téléphone sortant canonique
 */
export async function getTwilioPhoneNumber(tenantId?: number): Promise<string> {
  if (tenantId !== undefined) {
    const tenantPhone = await getAPIKey(tenantId, "twilio_phone");
    if (tenantPhone) {
      return ensurePhoneNumberConfigured(tenantPhone, `tenant ${tenantId} BYOK`);
    }

    const allowPlatformFallback = await isPlatformFallbackAllowed(tenantId);
    if (!allowPlatformFallback) {
      throw new Error(`[Twilio] Phone number missing for tenant ${tenantId}`);
    }
  }

  return ensurePhoneNumberConfigured(phoneNumber, "platform");
}

/**
 * Résout le tenant associé à un numéro appelé
 */
export class TwilioTenantResolver {
  static async resolveByCalledNumber(to: string): Promise<number | null> {
    const normalizedTo = to.startsWith("+") ? to : `+${to}`;
    const { getDbInstance } = await import("../db");
    const { tenants } = await import("../../drizzle/schema");
    const { sql } = await import("drizzle-orm");

    const db = getDbInstance();
    const rows = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        sql`(${tenants.settings}->>'twilioPhoneNumber' = ${to}
          OR ${tenants.settings}->>'twilioPhoneNumber' = ${normalizedTo})`
      )
      .limit(1);

    return rows[0]?.id ?? null;
  }
}

async function isPlatformFallbackAllowed(tenantId: number): Promise<boolean> {
  const { getDbInstance } = await import("../db");
  const { tenants } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const db = getDbInstance();

  const [tenant] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const parsedSettings = twilioSettingsSchema.safeParse(tenant?.settings ?? {});
  if (!parsedSettings.success) {
    logger.warn("[Twilio] Invalid tenant settings while checking platform fallback", {
      tenantId,
      issues: parsedSettings.error.issues,
    });
    return false;
  }

  return parsedSettings.data.allowPlatformFallback === true;
}

// ─── TRANSPORT METHODS ──────────────────────────────────────────────────────

/**
 * Initie un appel sortant (Outbound)
 */
export async function createOutboundCall(params: {
  tenantId: number;
  to: string;
  url: string;
  statusCallback?: string;
}): Promise<string> {
  const parsed = parseWithSchema(outboundCallSchema, params, "outbound call parameters");
  const client = await getTwilioClient(parsed.tenantId);
  const from = await getTwilioPhoneNumber(parsed.tenantId);

  const callParams: TwilioCallCreateParams = {
    from,
    to: parsed.to,
    url: parsed.url,
    record: true,
    ...(parsed.statusCallback ? { statusCallback: parsed.statusCallback } : {}),
  };

  const call = await client.calls.create(callParams);
  return call.sid;
}

/**
 * Envoie un SMS
 */
export async function sendSms(params: {
  tenantId: number;
  to: string;
  body: string;
}): Promise<string> {
  const parsed = parseWithSchema(sendSmsSchema, params, "SMS parameters");
  const client = await getTwilioClient(parsed.tenantId);
  const from = await getTwilioPhoneNumber(parsed.tenantId);

  const messageParams: TwilioMessageCreateParams = {
    from,
    to: parsed.to,
    body: parsed.body,
  };

  const message: MessageInstance = await client.messages.create(messageParams);
  return message.sid;
}

/**
 * Met à jour un appel en cours (Redirection, TwiML, etc.)
 */
export async function updateCall(params: {
  tenantId: number;
  callSid: string;
  twiml?: string;
  url?: string;
}): Promise<void> {
  const parsed = parseWithSchema(updateCallSchema, params, "call update parameters");
  const client = await getTwilioClient(parsed.tenantId);

  const updateParams: TwilioCallUpdateParams = {
    ...(parsed.twiml ? { twiml: parsed.twiml } : {}),
    ...(parsed.url ? { url: parsed.url } : {}),
  };

  await client.calls(parsed.callSid).update(updateParams);
}

/**
 * Récupère les détails d'un appel
 */
export async function getCallDetails(tenantId: number, callSid: string): Promise<CallInstance> {
  const parsedCallSid = parseWithSchema(callSidSchema, callSid, "callSid");
  const client = await getTwilioClient(tenantId);
  return client.calls(parsedCallSid).fetch();
}

/**
 * Termine un appel
 */
export async function endCall(callSid: string, tenantId?: number): Promise<void> {
  const parsedCallSid = parseWithSchema(callSidSchema, callSid, "callSid");
  const client = await getTwilioClient(tenantId);
  await client.calls(parsedCallSid).update({ status: "completed" });
}

/**
 * Transfère un appel vers un nouveau numéro ou une nouvelle URL TwiML
 */
export async function transferCall(params: { callSid: string; to: string; tenantId?: number }): Promise<void> {
  const parsed = parseWithSchema(transferCallSchema, params, "transfer call parameters");
  const client = await getTwilioClient(parsed.tenantId);

  const updateParams: TwilioCallUpdateParams = parsed.to.startsWith("http")
    ? { url: parsed.to }
    : { twiml: buildDialTransferTwiml(parsed.to) };

  await client.calls(parsed.callSid).update(updateParams);
}

/**
 * Gère les mises à jour de statut d'appel (Webhook)
 */
export async function handleCallStatusUpdate(params: unknown): Promise<void> {
  const parsed = parseWithSchema(callStatusUpdateSchema, params, "call status webhook payload");
  logger.info(`[Twilio] Call status update: ${parsed.CallSid} -> ${parsed.CallStatus}`, {
    callSid: parsed.CallSid,
    status: parsed.CallStatus,
    from: parsed.From,
    to: parsed.To,
    duration: parsed.Duration,
    recordingUrl: parsed.RecordingUrl,
  });

  // Ici on pourrait déclencher un événement de workflow call_status_changed
}

/**
 * Gère un appel entrant et retourne le TwiML canonique.
 */
export async function handleIncomingCall(params: unknown): Promise<string> {
  const parsed = parseWithSchema(incomingCallSchema, params, "incoming call payload");

  logger.info("[Twilio] Incoming call received", {
    callSid: parsed.callSid,
    from: parsed.from,
    to: parsed.to,
    status: parsed.status,
  });

  const response = new twilio.twiml.VoiceResponse();
  response.say("Service vocal en cours de configuration.", { voice: "alice", language: "fr-FR" });
  response.hangup();
  return response.toString();
}

/**
 * Initie un appel (Alias simplifié de createOutboundCall)
 */
export async function makeCall(params: { to: string; from?: string; tenantId?: number; url?: string }): Promise<string> {
  if (!params.tenantId) {
    throw new Error("[Twilio] tenantId is required for makeCall");
  }

  if (!params.url) {
    throw new Error("[Twilio] url is required for makeCall");
  }

  return createOutboundCall({
    to: params.to,
    tenantId: params.tenantId,
    url: params.url,
  });
}

/**
 * Envoie un message WhatsApp
 */
export async function sendWhatsAppMessage(params: { to: string; body: string; tenantId?: number }): Promise<string> {
  if (!params.tenantId) {
    throw new Error("[Twilio] tenantId is required for sendWhatsAppMessage");
  }

  return sendSms({
    to: `whatsapp:${params.to}`,
    body: params.body,
    tenantId: params.tenantId,
  });
}
