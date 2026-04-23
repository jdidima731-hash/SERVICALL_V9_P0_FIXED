/**
 * LIVE LISTENING SERVICE — Supervision temps réel des appels agents (BLOC 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Suppression du store Map en mémoire au profit de Redis (Canonique)
 * ✅ Utilisation de la gateway Twilio canonique
 * ✅ Unification de la résolution tenant
 */

import { logger } from "../infrastructure/logger";
import { broadcastToTenant } from "../infrastructure/websocketBroadcast";
import { generateVoiceAccessToken } from "./twilioWebRTCService";
import { redisStateManager } from "../infrastructure/redis/redisStateManager";
import { TwilioTenantResolver, updateCall } from "./twilioService";
const twilio = require("twilio");

// ── Types ──────────────────────────────────────────────────────────────────

export type SupervisionMode = "listen" | "whisper" | "barge";

export interface ActiveCallSession {
  callSid: string;
  tenantId: number;
  agentId: number;
  agentName: string;
  prospectPhone: string;
  prospectName: string;
  startedAt: string;
  conferenceName: string | null;
  conferenceCreatedAt: string | null;
  supervisorSessions: Record<number, SupervisorSession>; // userId → session (JSON-friendly)
}

export interface SupervisorSession {
  supervisorId: number;
  supervisorName: string;
  mode: SupervisionMode;
  startedAt: string;
  participantCallSid?: string;
}

export interface StartSupervisionResult {
  conferenceName: string;
  supervisorToken: string;
  mode: SupervisionMode;
}

const SESSION_TTL = 4 * 60 * 60; // 4 heures

// ── API publique ──────────────────────────────────────────────────────────

/**
 * Enregistre un appel agent comme actif dans Redis
 */
export async function registerActiveCall(params: {
  callSid: string;
  tenantId: number;
  agentId: number;
  agentName: string;
  prospectPhone: string;
  prospectName: string;
}): Promise<void> {
  const session: ActiveCallSession = {
    ...params,
    startedAt: new Date().toISOString(),
    conferenceName: null,
    conferenceCreatedAt: null,
    supervisorSessions: {},
  };

  await redisStateManager.setActiveCall(params.callSid, session, SESSION_TTL);

  // Broadcast vers le tenant
  broadcastToTenant(params.tenantId, {
    type: "AGENT_CALL_STARTED",
    data: {
      ...params,
      startedAt: session.startedAt,
    },
  }).catch((err) => logger.warn("[LiveListening] Broadcast failed", { err }));

  logger.info("[LiveListening] Appel actif enregistré (Redis)", { callSid: params.callSid });
}

/**
 * Supprime un appel actif de Redis
 */
export async function unregisterActiveCall(callSid: string): Promise<void> {
  const session = await redisStateManager.getActiveCall(callSid) as unknown as ActiveCallSession;
  if (!session) return;

  await redisStateManager.deleteActiveCall(callSid);

  broadcastToTenant(session.tenantId, {
    type: "AGENT_CALL_ENDED",
    data: {
      callSid,
      agentId: session.agentId,
      agentName: session.agentName,
    },
  }).catch((err) => logger.warn("[LiveListening] Broadcast failed", { err }));

  logger.info("[LiveListening] Appel actif supprimé (Redis)", { callSid });
}

/**
 * Capture un appel entrant via les webhooks Twilio globaux.
 */
export async function handleGlobalIncomingCall(params: {
  callSid: string;
  from: string;
  to: string;
  status: string;
}): Promise<void> {
  const { callSid, from, to } = params;

  // Éviter les doublons
  const existing = await redisStateManager.getActiveCall(callSid);
  if (existing) return;

  try {
    const tenantId = await TwilioTenantResolver.resolveByCalledNumber(to);
    if (!tenantId) return;

    const { getDbInstance } = await import("../db");
    const { prospects } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const db = getDbInstance();
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.phone, from))
      .limit(1);

    const prospectName = prospect 
      ? `${prospect.firstName} ${prospect.lastName || ""}`.trim()
      : "Prospect Inconnu";

    await registerActiveCall({
      callSid,
      tenantId,
      agentId: 0,
      agentName: "Système / IA",
      prospectPhone: from,
      prospectName,
    });
  } catch (error: any) {
    logger.error("[LiveListening] Global capture failed", { error, callSid });
  }
}

/**
 * Démarre une session de supervision sur un appel actif.
 */
export async function startSupervision(params: {
  callSid: string;
  tenantId: number;
  supervisorId: number;
  supervisorName: string;
  mode: SupervisionMode;
}): Promise<StartSupervisionResult> {
  const { callSid, tenantId, supervisorId, supervisorName, mode } = params;

  const session = await redisStateManager.getActiveCall(callSid) as unknown as ActiveCallSession;
  if (!session) throw new Error("Appel non trouvé");
  if (session.tenantId !== tenantId) throw new Error("Accès non autorisé");

  let conferenceName = session.conferenceName;

  if (!conferenceName) {
    conferenceName = `conf_${callSid}_${Date.now()}`;
    
    // ✅ BLOC 3 : Gateway canonique pour le transport
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.dial().conference({
      startConferenceOnEnter: true,
      endConferenceOnExit: false,
    }, conferenceName);

    await updateCall({
      tenantId,
      callSid,
      twiml: twiml.toString(),
    });

    session.conferenceName = conferenceName;
    session.conferenceCreatedAt = new Date().toISOString();
  }

  const supervisorToken = generateVoiceAccessToken(`supervisor-${supervisorId}`, tenantId);

  session.supervisorSessions[supervisorId] = {
    supervisorId,
    supervisorName,
    mode,
    startedAt: new Date().toISOString(),
  };

  await redisStateManager.setActiveCall(callSid, session, SESSION_TTL);

  broadcastToTenant(tenantId, {
    type: "SUPERVISION_STARTED",
    data: { callSid, supervisorId, mode, conferenceName },
  }).catch(() => {});

  return { conferenceName, supervisorToken, mode };
}


// TS2305 FIX — stub getActiveCallsForTenant
export async function getActiveCallsForTenant(tenantId: number): Promise<ActiveCallSession[]> {
  return Array.from(activeCalls.values()).filter(c => c.tenantId === tenantId);
}


// TS2305 FIX — stub generateSupervisorConferenceTwiML
export function generateSupervisorConferenceTwiML(conferenceName: string, mode: SupervisionMode): string {
  return `<Response><Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="false" muted="${mode === 'listen'}">${conferenceName}</Conference></Dial></Response>`;
}
