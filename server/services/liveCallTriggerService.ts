/**
 * LIVE CALL TRIGGER SERVICE
 * Déclenche les workflows au démarrage d'un appel entrant en temps réel
 */

import { logger } from "../infrastructure/logger";
import { randomUUID } from "crypto";

export interface LiveCallTriggerPayload {
  callSid: string;
  callId?: number;
  tenantId: number;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  prospect?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export const LiveCallTriggerService = {
  /**
   * Déclenche le workflow "live_call_started" de manière asynchrone (fire-and-forget).
   * Ne bloque pas la réponse TwiML.
   */
  triggerAsync(payload: LiveCallTriggerPayload): void {
    void LiveCallTriggerService._trigger(payload).catch((err: any) => {
      logger.error("[LiveCallTrigger] Async trigger failed", {
        callSid: payload.callSid,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  },

  async _trigger(payload: LiveCallTriggerPayload): Promise<void> {
    logger.info("[LiveCallTrigger] Triggering live_call_started workflow", {
      callSid: payload.callSid,
      callId: payload.callId,
      tenantId: payload.tenantId,
      direction: payload.direction,
    });

    try {
      const { WorkflowEngine } = await import("../workflow-engine/core/WorkflowEngine");
      const { Channel, EventType } = await import("../workflow-engine/types");

      const engine = new WorkflowEngine();

      // Construire l'IncomingEvent compatible avec WorkflowEngine.handle()
      await engine.handle({
        id: `live_call_${payload.callSid}_${randomUUID()}`,
        tenant_id: payload.tenantId,
        channel: payload.direction === "inbound" ? Channel.CALL : Channel.CALL,
        type: payload.direction === "inbound" ? EventType.INBOUND : EventType.OUTBOUND,
        source: payload.from,
        destination: payload.to,
        data: {
          callSid: payload.callSid,
          callId: payload.callId,
          prospect: payload.prospect ?? null,
        },
        metadata: {
          agentType: payload.metadata?.["agentType"],
          userId: payload.metadata?.["userId"],
          triggerType: "live_call_started",
        },
        status: "pending",
        created_at: new Date(),
      });

      logger.info("[LiveCallTrigger] Workflow triggered successfully", {
        callSid: payload.callSid,
      });
    } catch (error: any) {
      logger.error("[LiveCallTrigger] Workflow engine error", {
        error: error instanceof Error ? error.message : String(error),
        callSid: payload.callSid,
      });
      throw error;
    }
  },
};
