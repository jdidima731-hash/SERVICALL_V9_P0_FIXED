/**
 * FLEXIBLE CALL SERVICE
 * ✅ PHASE 2 — Tâche 5 : Sessions migrées de Map mémoire vers Redis
 *
 * Structure Redis : session:{callSid}
 * TTL : 3600 secondes
 */
import { logger } from "../infrastructure/logger";
import { metrics } from "./metricsService";
import { getRedisClient } from "../infrastructure/redis/redis.client";

export type CallMode = "ia_only" | "human_only" | "hybrid";

export interface CallConfig {
  mode: CallMode;
  maxRingsBeforeAI: number;
  tenantId: number;
  fallbackToAI: boolean;
}

interface CallState {
  config: CallConfig;
  rings: number;
  status: "ringing" | "active" | "transferred";
  startTime: number;
}

const SESSION_TTL = 3600; // secondes

/**
 * Flexible Call Service - Gère l'orchestration IA/Humain et les bascules automatiques
 * Les sessions sont stockées dans Redis pour la scalabilité horizontale.
 */
class FlexibleCallService {
  private getKey(callSid: string): string {
    return `session:${callSid}`;
  }

  private async getSession(callSid: string): Promise<CallState | null> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(this.getKey(callSid));
      return data ? (JSON.parse(data) as CallState) : null;
    } catch (err: any) {
      logger.error("[Flexible Call] Redis get error", err, { callSid });
      return null;
    }
  }

  private async setSession(callSid: string, state: CallState): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.set(this.getKey(callSid), JSON.stringify(state), "EX", SESSION_TTL);
    } catch (err: any) {
      logger.error("[Flexible Call] Redis set error", err, { callSid });
    }
  }

  private async deleteSession(callSid: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(this.getKey(callSid));
    } catch (err: any) {
      logger.error("[Flexible Call] Redis del error", err, { callSid });
    }
  }

  /**
   * Initialiser un nouvel appel avec une configuration spécifique
   */
  async initCall(callSid: string, config: CallConfig): Promise<void> {
    logger.info(`[Flexible Call] Initializing call ${callSid} in mode: ${config.mode}`, {
      callSid,
      tenantId: config.tenantId,
      mode: config.mode,
    });

    await this.setSession(callSid, {
      config,
      rings: 0,
      status: "ringing",
      startTime: Date.now(),
    });

    metrics.recordBusinessMetric("call_initiated", 1, "count", config.tenantId);
  }

  /**
   * Simuler une sonnerie et vérifier si une bascule est nécessaire
   */
  async handleRing(callSid: string): Promise<{ action: "continue_ringing" | "switch_to_ai" | "hangup" }> {
    const call = await this.getSession(callSid);
    if (!call) return { action: "hangup" };

    if (call.config.mode === "ia_only") {
      return { action: "switch_to_ai" };
    }

    call.rings += 1;
    logger.debug(`[Flexible Call] Call ${callSid} ring count: ${call.rings}`);

    if (call.config.mode === "human_only") {
      if (call.rings >= call.config.maxRingsBeforeAI && call.config.fallbackToAI) {
        logger.warn(
          `[Flexible Call] No human response for ${callSid} after ${call.rings} rings. Switching to AI fallback.`
        );
        metrics.recordBusinessMetric("auto_switch_to_ai", 1, "count", call.config.tenantId);
        await this.setSession(callSid, call);
        return { action: "switch_to_ai" };
      }
      await this.setSession(callSid, call);
      return { action: "continue_ringing" };
    }

    if (call.config.mode === "hybrid") {
      if (call.rings >= call.config.maxRingsBeforeAI) {
        await this.setSession(callSid, call);
        return { action: "switch_to_ai" };
      }
      await this.setSession(callSid, call);
      return { action: "continue_ringing" };
    }

    await this.setSession(callSid, call);
    return { action: "continue_ringing" };
  }

  /**
   * Terminer un appel et enregistrer les métriques
   */
  async endCall(callSid: string): Promise<void> {
    const call = await this.getSession(callSid);
    if (call) {
      const duration = (Date.now() - call.startTime) / 1000;
      logger.info(`[Flexible Call] Call ${callSid} ended. Duration: ${duration}s`, {
        callSid,
        tenantId: call.config.tenantId,
        duration,
      });
      await this.deleteSession(callSid);
    }
  }

  /**
   * Obtenir la configuration d'un appel actif
   */
  async getCallConfig(callSid: string): Promise<CallConfig | undefined> {
    const session = await this.getSession(callSid);
    return session?.config;
  }
}

export const flexibleCallService = new FlexibleCallService();
