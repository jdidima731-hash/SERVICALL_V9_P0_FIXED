/**
 * SMART TRANSFER SERVICE
 * ─────────────────────────────────────────────────────────────────────────────
 * Logique intelligente de décision pour le transfert IA → Humain.
 *
 * Règles métier :
 *  1. L'IA ne dispose pas de l'info demandée         → Transfer humain (si dispo) sinon rappel
 *  2. Appelant demande explicitement un humain        → Transfer humain (si dispo) sinon rappel
 *  3. Humain demandé mais NON disponible              → Planifier rappel automatique
 *  4. Humain disponible                               → Transfer Twilio immédiat
 *  5. Rappel : notification via CRM, téléphone, ou les deux (config user)
 */

import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { users, type User } from "../../drizzle/schema";
import { scheduledCallbacks, type InsertScheduledCallback } from "../../drizzle/schema-calls";
import { eq, and } from "drizzle-orm";
import twilio from "twilio";
import { ENV } from "../_core/env";

export type TransferTrigger =
  | "no_info"          // IA sans réponse à la question
  | "caller_request"   // Appelant demande un humain
  | "sentiment_low"    // Sentiment négatif détecté
  | "manual";          // Demande manuelle admin/agent

export type TransferDecision =
  | { action: "transfer_human"; agentPhone: string; userId: number }
  | { action: "schedule_callback"; callbackId: number; scheduledAt: Date; notifyMode: string }
  | { action: "no_agent_configured" };

export interface TransferRequest {
  tenantId: number;
  callSid: string;
  callId?: number;
  prospectPhone: string;
  prospectName?: string;
  prospectId?: number;
  trigger: TransferTrigger;
  conversationSummary: string;
  // Délai souhaité pour le rappel (minutes) — par défaut 60min
  preferredCallbackDelayMinutes?: number;
}

/**
 * Point d'entrée principal — détermine et exécute la meilleure action de transfert.
 */
export async function resolveTransfer(req: TransferRequest): Promise<TransferDecision> {
  const db = getDbInstance();
  if (!db) throw new Error("Database not available");

  logger.info("[SmartTransfer] Resolving transfer", {
    tenantId: req.tenantId,
    trigger: req.trigger,
    callSid: req.callSid,
  });

  // 1. Chercher un agent humain disponible pour ce tenant
  const availableAgents = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tenantId, req.tenantId),
        eq(users.isActive, true),
        eq(users.isAvailableForTransfer, true)
      )
    )
    .limit(5);

  // Filtrer les agents qui ont un numéro de téléphone configuré
  const agentsWithPhone = availableAgents.filter(
    (u) => !!u.callbackPhone
  );

  if (agentsWithPhone.length > 0) {
    // ── Humain disponible → transfert immédiat ──────────────────────────────
    const agent = agentsWithPhone[0];
    const agentPhone = agent.callbackPhone as string;

    logger.info("[SmartTransfer] Human agent available → transferring", {
      agentId: agent.id,
      agentPhone,
    });

    return {
      action: "transfer_human",
      agentPhone,
      userId: agent.id,
    };
  }

  // ── Aucun humain disponible → planifier un rappel ──────────────────────────
  logger.info("[SmartTransfer] No human available → scheduling callback", {
    tenantId: req.tenantId,
    trigger: req.trigger,
  });

  return scheduleCallback(req, db);
}

/**
 * Planifie un rappel et notifie l'agent selon son mode configuré.
 */
async function scheduleCallback(
  req: TransferRequest,
  db: ReturnType<typeof getDbInstance>
): Promise<TransferDecision> {
  if (!db) throw new Error("Database not available");

  const delayMinutes = req.preferredCallbackDelayMinutes ?? 60;
  const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

  // Chercher un agent assigné même non disponible (pour la notification)
  const anyAgent = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.tenantId, req.tenantId),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  const agent = anyAgent[0] ?? null;
  const notifyMode = agent ? (agent.callbackNotifyMode ?? "crm") : "crm";

  // Insérer en base
  const [inserted] = await db
    .insert(scheduledCallbacks)
    .values({
      tenantId: req.tenantId,
      prospectPhone: req.prospectPhone,
      prospectName: req.prospectName,
      prospectId: req.prospectId,
      callSid: req.callSid,
      callId: req.callId,
      triggerReason: req.trigger,
      scheduledAt,
      notifyMode,
      assignedUserId: agent?.id ?? null,
      status: "pending",
      conversationSummary: req.conversationSummary,
      metadata: {
        agentId: agent?.id,
        agentName: agent?.name,
        trigger: req.trigger,
      },
    } as InsertScheduledCallback)
    .returning({ id: scheduledCallbacks.id });

  const callbackId = inserted.id;

  logger.info("[SmartTransfer] Callback scheduled", {
    callbackId,
    scheduledAt,
    notifyMode,
    agentId: agent?.id,
  });

  // Notifier immédiatement selon le mode configuré
  setImmediate(async () => {
    await notifyAgentOfCallback({
      callbackId,
      agent,
      req,
      scheduledAt,
      notifyMode,
    });
  });

  return {
    action: "schedule_callback",
    callbackId,
    scheduledAt,
    notifyMode,
  };
}

/**
 * Envoie la notification à l'agent (CRM event, appel téléphonique, ou les deux).
 */
async function notifyAgentOfCallback(params: {
  callbackId: number;
  agent: User | null;
  req: TransferRequest;
  scheduledAt: Date;
  notifyMode: string;
}): Promise<void> {
  const { callbackId, agent, req, scheduledAt, notifyMode } = params;
  const db = getDbInstance();
  if (!db) return;

  try {
    // ── Mode CRM ou BOTH : émettre un événement WebSocket vers le dashboard ──
    if (notifyMode === "crm" || notifyMode === "both") {
      await emitCRMCallbackNotification({
        callbackId,
        tenantId: req.tenantId,
        prospectPhone: req.prospectPhone,
        prospectName: req.prospectName,
        scheduledAt,
        trigger: req.trigger,
        conversationSummary: req.conversationSummary,
        agentId: agent?.id,
        agentName: agent?.name,
      });
    }

    // ── Mode PHONE ou BOTH : appel Twilio vers le numéro de l'agent ──────────
    if ((notifyMode === "phone" || notifyMode === "both") && agent?.callbackPhone) {
      await callAgentForCallback({
        agentPhone: agent.callbackPhone,
        prospectPhone: req.prospectPhone,
        prospectName: req.prospectName ?? "Prospect",
        scheduledAt,
        conversationSummary: req.conversationSummary,
        callbackId,
      });
    }

    // Marquer comme notifié
    await db
      .update(scheduledCallbacks)
      .set({ status: "notified", updatedAt: new Date() })
      .where(eq(scheduledCallbacks.id, callbackId));

    logger.info("[SmartTransfer] Agent notified", { callbackId, notifyMode });
  } catch (err: unknown) {
    logger.error("[SmartTransfer] Notification failed", { 
      err: err instanceof Error ? err.message : String(err), 
      callbackId 
    });
    await db
      .update(scheduledCallbacks)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(scheduledCallbacks.id, callbackId));
  }
}

/**
 * Émet un événement SSE/WebSocket vers le CRM de l'agent.
 * Utilise le module WebSocket global de l'application (injected at runtime).
 */
async function emitCRMCallbackNotification(payload: {
  callbackId: number;
  tenantId: number;
  prospectPhone: string;
  prospectName?: string;
  scheduledAt: Date;
  trigger: string;
  conversationSummary: string;
  agentId?: number;
  agentName?: string;
}): Promise<void> {
  try {
    // Import dynamique pour éviter les dépendances circulaires
    const { broadcastToTenant } = await import("../infrastructure/websocketBroadcast");
    await broadcastToTenant(payload.tenantId, {
      type: "CALLBACK_SCHEDULED",
      data: {
        ...payload,
        scheduledAt: payload.scheduledAt.toISOString(),
        triggerLabel: getTriggerLabel(payload.trigger),
      },
    });
    logger.info("[SmartTransfer] CRM notification sent", { callbackId: payload.callbackId });
  } catch (err: unknown) {
    logger.warn("[SmartTransfer] CRM broadcast failed (non-blocking)", { 
      err: err instanceof Error ? err.message : String(err) 
    });
  }
}

function getTriggerLabel(trigger: string): string {
  switch (trigger) {
    case "no_info": return "IA sans réponse";
    case "caller_request": return "Demande client";
    case "sentiment_low": return "Sentiment négatif";
    case "manual": return "Manuel";
    default: return trigger;
  }
}

/**
 * Appelle le téléphone de l'agent via Twilio pour le prévenir d'un rappel à faire.
 * L'agent entend un message vocal avec le contexte de l'appel.
 */
async function callAgentForCallback(params: {
  agentPhone: string;
  prospectPhone: string;
  prospectName: string;
  scheduledAt: Date;
  conversationSummary: string;
  callbackId: number;
}): Promise<void> {
  const accountSid = ENV.twilioAccountSid;
  const authToken = ENV.twilioAuthToken;
  const fromNumber = ENV.twilioPhoneNumber;

  if (!accountSid?.startsWith("AC") || !authToken || !fromNumber) {
    logger.warn("[SmartTransfer] Twilio not configured — skipping phone notification");
    return;
  }

  const client = twilio(accountSid, authToken);
  const scheduledStr = params.scheduledAt.toLocaleString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: "alice", language: "fr-FR" },
    `Bonjour. Vous avez un rappel client à effectuer. ` +
    `Le prospect ${params.prospectName} vous a contacté. ` +
    `Résumé : ${params.conversationSummary.slice(0, 200)}. ` +
    `Rappel planifié pour ${scheduledStr}. ` +
    `Son numéro est le ${params.prospectPhone.split("").join(" ")}. ` +
    `Consultez votre CRM Servicall pour plus de détails. Bonne journée.`
  );

  try {
    const call = await client.calls.create({
      from: fromNumber,
      to: params.agentPhone,
      twiml: twiml.toString(),
    });

    logger.info("[SmartTransfer] Agent phone call initiated", {
      agentPhone: params.agentPhone,
      callSid: call.sid,
      callbackId: params.callbackId,
    });

    // Sauvegarder le SID du rappel
    const db = getDbInstance();
    if (db) {
      await db
        .update(scheduledCallbacks)
        .set({ callbackCallSid: call.sid, updatedAt: new Date() })
        .where(eq(scheduledCallbacks.id, params.callbackId));
    }
  } catch (err: unknown) {
    logger.error("[SmartTransfer] Failed to call agent phone", { 
      err: err instanceof Error ? err.message : String(err), 
      agentPhone: params.agentPhone 
    });
  }
}

/**
 * Génère un TwiML de transfert immédiat vers un agent humain.
 * Inclut un message de contexte à l'agent avant la mise en relation.
 */
export function buildTransferTwiML(params: {
  agentPhone: string;
  prospectName: string;
  trigger: TransferTrigger;
  summary: string;
}): string {
  const twiml = new twilio.twiml.VoiceResponse();
  
  const triggerMsg = params.trigger === "caller_request" 
    ? "Le client demande à vous parler." 
    : "L'IA n'a pas pu répondre à une question spécifique.";

  // Message chuchoté à l'agent (Whisper)
  const dial = twiml.dial({
    callerId: ENV.twilioPhoneNumber,
  });
  
  dial.number({
    url: `/api/twilio/whisper?msg=${encodeURIComponent(
      `Appel Servicall. ${params.prospectName}. ${triggerMsg}`
    )}`,
  }, params.agentPhone);

  return twiml.toString();
}
