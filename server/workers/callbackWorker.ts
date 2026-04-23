import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { scheduledCallbacks } from "../../drizzle/schema-calls";
import { users } from "../../drizzle/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { broadcastToTenant, broadcastToAgent } from "../infrastructure/websocketBroadcast";
import { updateCall } from "../services/twilioService";
const twilio = require("twilio");

/**
 * CALLBACK WORKER — Exécuteur de rappels (BLOC 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Unification du transport via TwilioService (Gateway canonique)
 * ✅ Suppression de toute orchestration Twilio directe
 */

const WORKER_INTERVAL_MS = 2 * 60 * 1000;
let workerTimer: NodeJS.Timeout | null = null;

export function startCallbackWorker(): void {
  if (workerTimer) return;
  logger.info("[CallbackWorker] Starting — interval 2 min");
  workerTimer = setInterval(runCallbackCheck, WORKER_INTERVAL_MS);
  runCallbackCheck().catch((err) => logger.error("[CallbackWorker] Initial run failed", { err }));
}

export function stopCallbackWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info("[CallbackWorker] Stopped");
  }
}

async function runCallbackCheck(): Promise<void> {
  const db = getDbInstance();

  try {
    const now = new Date();
    const pendingCallbacks = await db
      .select()
      .from(scheduledCallbacks)
      .where(
        and(
          inArray(scheduledCallbacks.status, ["pending", "notified"]),
          lte(scheduledCallbacks.scheduledAt, now)
        )
      )
      .limit(20);

    if (pendingCallbacks.length === 0) return;

    for (const callback of pendingCallbacks) {
      try {
        await processCallback(callback);
      } catch (err: any) {
        logger.error("[CallbackWorker] Failed to process callback", { err, callbackId: callback.id });
        await db.update(scheduledCallbacks)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(scheduledCallbacks.id, callback.id))
          .catch(() => {});
      }
    }
  } catch (err: any) {
    logger.error("[CallbackWorker] Check cycle failed", { err });
  }
}

async function processCallback(callback: typeof scheduledCallbacks.$inferSelect): Promise<void> {
  const db = getDbInstance();
  const notifyMode = callback.notifyMode ?? "crm";

  // ── Mode CRM ou BOTH ──────────────────────────────────────────────────────
  if (notifyMode === "crm" || notifyMode === "both") {
    const payload = {
      type: "CALLBACK_SCHEDULED" as const,
      data: {
        callbackId: callback.id,
        tenantId: callback.tenantId,
        prospectPhone: callback.prospectPhone,
        prospectName: callback.prospectName ?? "Prospect",
        scheduledAt: callback.scheduledAt?.toISOString(),
        dueNow: true,
      },
    };

    if (callback.assignedUserId) {
      await broadcastToAgent(callback.tenantId, callback.assignedUserId, payload);
    } else {
      await broadcastToTenant(callback.tenantId, payload);
    }
  }

  // ── Mode PHONE ou BOTH ────────────────────────────────────────────────────
  let callbackCallSid: string | null = null;
  if (notifyMode === "phone" || notifyMode === "both") {
    const [agent] = await db.select({ phone: users.callbackPhone })
      .from(users).where(eq(users.id, callback.assignedUserId!)).limit(1);

    if (agent?.phone) {
      // ✅ BLOC 3 : Gateway canonique
      const { createOutboundCall } = await import("../services/twilioService");
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: "alice", language: "fr-FR" }, 
        `Rappel Servicall pour ${callback.prospectName ?? "un prospect"}.`);
      
      callbackCallSid = await createOutboundCall({
        tenantId: callback.tenantId,
        to: agent.phone,
        url: `data:text/xml,${encodeURIComponent(twiml.toString())}`,
      });
    }
  }

  await db.update(scheduledCallbacks)
    .set({
      status: "called",
      callbackCallSid: callbackCallSid ?? callback.callbackCallSid,
      updatedAt: new Date(),
    })
    .where(eq(scheduledCallbacks.id, callback.id));
}
