/**
 * REALTIME WORKFLOW MONITOR SERVICE
 * ✅ PHASE 2 — Tâche 5 : Sessions migrées de Map mémoire vers Redis
 *
 * Structure Redis :
 *   session:{callSid}      → état de l'appel actif (TTL 3600s)
 *   conversation:{callSid} → historique de conversation (TTL 3600s)
 */
import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { getDbInstance } from "../db";
import { eq, desc } from "drizzle-orm";
import { calls } from "../../drizzle/schema";

export interface RealtimeCallStatus {
  callId: number;
  callSid: string;
  tenantId: number;
  status: "in_progress" | "completed" | "failed" | "timeout";
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  startedAt: string; // ISO string pour la sérialisation JSON
  currentAction?: string;
  lastUpdate: string; // ISO string pour la sérialisation JSON
  errors: string[];
  metrics: {
    duration?: number;
    actionsCompleted: number;
    actionsFailed: number;
  };
}

const SESSION_TTL = 3600; // secondes
const HISTORY_KEY = "realtime:call_history";
const MAX_HISTORY_SIZE = 100;

export class RealtimeWorkflowMonitor {
  private static sessionKey(callSid: string): string {
    return `session:${callSid}`;
  }

  private static async getSession(callSid: string): Promise<RealtimeCallStatus | null> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(RealtimeWorkflowMonitor.sessionKey(callSid));
      return data ? (JSON.parse(data) as RealtimeCallStatus) : null;
    } catch (err: any) {
      logger.error("[RealtimeMonitor] Redis get error", err, { callSid });
      return null;
    }
  }

  private static async setSession(callSid: string, status: RealtimeCallStatus): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.set(
        RealtimeWorkflowMonitor.sessionKey(callSid),
        JSON.stringify(status),
        "EX",
        SESSION_TTL
      );
    } catch (err: any) {
      logger.error("[RealtimeMonitor] Redis set error", err, { callSid });
    }
  }

  private static async deleteSession(callSid: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(RealtimeWorkflowMonitor.sessionKey(callSid));
    } catch (err: any) {
      logger.error("[RealtimeMonitor] Redis del error", err, { callSid });
    }
  }

  /**
   * Enregistre le début d'un appel en temps réel
   */
  static async startCall(params: {
    callId: number;
    callSid: string;
    tenantId: number;
    direction: "inbound" | "outbound";
    from: string;
    to: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const status: RealtimeCallStatus = {
      callId: params.callId,
      callSid: params.callSid,
      tenantId: params.tenantId,
      status: "in_progress",
      direction: params.direction,
      from: params.from,
      to: params.to,
      startedAt: now,
      lastUpdate: now,
      errors: [],
      metrics: { actionsCompleted: 0, actionsFailed: 0 },
    };

    await RealtimeWorkflowMonitor.setSession(params.callSid, status);

    logger.info("[RealtimeMonitor] Call started", {
      callSid: params.callSid,
      tenantId: params.tenantId,
      direction: params.direction,
    });
  }

  /**
   * Met à jour l'action en cours pour un appel
   */
  static async updateCurrentAction(callSid: string, actionName: string): Promise<void> {
    const call = await RealtimeWorkflowMonitor.getSession(callSid);
    if (!call) {
      logger.warn("[RealtimeMonitor] Call not found for action update", { callSid, actionName });
      return;
    }

    call.currentAction = actionName;
    call.lastUpdate = new Date().toISOString();
    await RealtimeWorkflowMonitor.setSession(callSid, call);

    logger.debug("[RealtimeMonitor] Action updated", {
      callSid,
      actionName,
      tenantId: call.tenantId,
    });
  }

  /**
   * Enregistre le succès d'une action
   */
  static async recordActionSuccess(callSid: string, actionName: string, duration?: number): Promise<void> {
    const call = await RealtimeWorkflowMonitor.getSession(callSid);
    if (!call) return;

    call.metrics.actionsCompleted++;
    call.lastUpdate = new Date().toISOString();
    await RealtimeWorkflowMonitor.setSession(callSid, call);

    logger.info("[RealtimeMonitor] Action completed", {
      callSid,
      actionName,
      duration,
      tenantId: call.tenantId,
      totalCompleted: call.metrics.actionsCompleted,
    });
  }

  /**
   * Enregistre l'échec d'une action
   */
  static async recordActionFailure(callSid: string, actionName: string, error: string): Promise<void> {
    const call = await RealtimeWorkflowMonitor.getSession(callSid);
    if (!call) return;

    call.metrics.actionsFailed++;
    call.errors.push(`${actionName}: ${error}`);
    call.lastUpdate = new Date().toISOString();
    await RealtimeWorkflowMonitor.setSession(callSid, call);

    logger.error("[RealtimeMonitor] Action failed", {
      callSid,
      actionName,
      error,
      tenantId: call.tenantId,
      totalFailed: call.metrics.actionsFailed,
    });
  }

  /**
   * Termine un appel et le déplace dans l'historique Redis
   */
  static async endCall(
    callSid: string,
    finalStatus: "completed" | "failed" | "timeout",
    duration?: number
  ): Promise<void> {
    const call = await RealtimeWorkflowMonitor.getSession(callSid);
    if (!call) {
      logger.warn("[RealtimeMonitor] Call not found for end", { callSid });
      return;
    }

    call.status = finalStatus;
    call.lastUpdate = new Date().toISOString();
    if (duration !== undefined) call.metrics.duration = duration;

    try {
      const redis = getRedisClient();
      // Ajouter à l'historique (liste Redis, limité à MAX_HISTORY_SIZE)
      await redis.lpush(HISTORY_KEY, JSON.stringify(call));
      await redis.ltrim(HISTORY_KEY, 0, MAX_HISTORY_SIZE - 1);
      await redis.expire(HISTORY_KEY, SESSION_TTL * 24); // 24h pour l'historique
    } catch (err: any) {
      logger.error("[RealtimeMonitor] Redis history error", err, { callSid });
    }

    await RealtimeWorkflowMonitor.deleteSession(callSid);

    logger.info("[RealtimeMonitor] Call ended", {
      callSid,
      finalStatus,
      duration,
      tenantId: call.tenantId,
      actionsCompleted: call.metrics.actionsCompleted,
      actionsFailed: call.metrics.actionsFailed,
      errors: call.errors.length,
    });
  }

  /**
   * Récupère le statut d'un appel spécifique
   */
  static async getCallStatus(callSid: string): Promise<RealtimeCallStatus | null> {
    return RealtimeWorkflowMonitor.getSession(callSid);
  }

  /**
   * Récupère les appels récents depuis la base de données
   */
  static async getRecentCallsFromDB(tenantId: number, limit: number = 10): Promise<any[]> {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const recentCalls = await db
        .select()
        .from(calls)
        .where(eq(calls.tenantId, tenantId))
        .orderBy(desc(calls.createdAt))
        .limit(limit);

      return recentCalls;
    } catch (error: any) {
      logger.error("[RealtimeMonitor] Error fetching recent calls from DB", {
        error: error instanceof Error ? error.message : String(error),
        tenantId,
      });
      return [];
    }
  }
}
