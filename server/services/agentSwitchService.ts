import { getDbInstance } from "../db";
import { logger } from "../infrastructure/logger";
import { users, agentSwitchHistory } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Service de gestion de la bascule entre Agent IA et Agent Humain
 */

// ✅ FIX — Type AgentMode étendu avec "BOTH" (mode copilot IA + agent humain simultané)
// AI   : L'IA répond seule à l'appel (pipeline vocal IA)
// HUMAN: Un agent humain répond (transfert Twilio vers numéro humain)
// BOTH : L'agent humain répond ET l'IA lui envoie des suggestions en temps réel (copilot)
export type AgentMode = "AI" | "HUMAN" | "BOTH";

export interface SwitchAgentParams {
  userId: number;
  newAgentType: AgentMode;
  tenantId: number;
  callId?: number;
  reason?: string;
  triggeredBy: string; // "admin", "system", "user"
  triggeredByUserId?: number;
}

/**
 * Bascule un utilisateur vers un type d'agent (IA, Humain, ou les deux)
 */
export async function switchAgentType(params: SwitchAgentParams): Promise<void> {
  const db = getDbInstance();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const usersTable = users;
    const historyTable = agentSwitchHistory;

    const userResult = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.userId))
      .limit(1);

    if (userResult.length === 0) {
      throw new Error(`User ${params.userId} not found`);
    }

    const currentUser = userResult[0];
    const previousAgentType = currentUser.assignedAgentType as AgentMode | null;

    if (previousAgentType === params.newAgentType) {
      logger.info("[AgentSwitch] Agent type already set", {
        userId: params.userId,
        agentType: params.newAgentType,
      });
      return;
    }

    await db
      .update(usersTable)
      .set({ assignedAgentType: params.newAgentType })
      .where(eq(usersTable.id, params.userId));

    
    await db.insert(historyTable).values({
      userId: params.userId,
      callId: params.callId,
      tenantId: params.tenantId,
      previousAgentType,
      newAgentType: params.newAgentType,
      reason: params.reason,
      triggeredBy: params.triggeredBy,
      triggeredByUserId: params.triggeredByUserId,
      createdAt: new Date(),
    });

    logger.info("[AgentSwitch] Agent type switched successfully", {
      userId: params.userId,
      previousAgentType,
      newAgentType: params.newAgentType,
      triggeredBy: params.triggeredBy,
    });
  } catch (error: any) {
    logger.error("[AgentSwitch] Failed to switch agent type", {
      error,
      userId: params.userId,
      newAgentType: params.newAgentType,
    });
    throw error;
  }
}

/**
 * Force la bascule vers un agent humain
 */
export async function forceHumanAgent(
  userId: number,
  tenantId: number,
  triggeredByUserId?: number,
  reason?: string,
  callId?: number
): Promise<void> {
  return switchAgentType({
    userId,
    newAgentType: "HUMAN",
    tenantId,
    callId,
    reason: reason || "Manual switch to human agent",
    triggeredBy: triggeredByUserId ? "admin" : "system",
    triggeredByUserId,
  });
}

/**
 * Force la bascule vers un agent IA
 */
export async function forceAIAgent(
  userId: number,
  tenantId: number,
  triggeredByUserId?: number,
  reason?: string,
  callId?: number
): Promise<void> {
  return switchAgentType({
    userId,
    newAgentType: "AI",
    tenantId,
    callId,
    reason: reason || "Manual switch to AI agent",
    triggeredBy: triggeredByUserId ? "admin" : "system",
    triggeredByUserId,
  });
}

/**
 * ✅ FIX — Active le mode BOTH : agent humain + copilot IA simultané
 * L'agent humain gère l'appel, l'IA analyse en temps réel et envoie
 * des suggestions via WebSocket (RealtimeAgentCoachingService).
 */
export async function forceBothMode(
  userId: number,
  tenantId: number,
  triggeredByUserId?: number,
  reason?: string,
  callId?: number
): Promise<void> {
  return switchAgentType({
    userId,
    newAgentType: "BOTH",
    tenantId,
    callId,
    reason: reason || "Hybrid mode: human agent + AI copilot",
    triggeredBy: triggeredByUserId ? "admin" : "system",
    triggeredByUserId,
  });
}

/**
 * Récupère le type d'agent actuel d'un utilisateur
 */
export async function getAgentType(userId: number): Promise<AgentMode | null> {
  const db = getDbInstance();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const usersTable = users;

    const userResult = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return null;
    }

    const raw = (userResult[0].assignedAgentType as string)?.toUpperCase();
    if (raw === "AI" || raw === "HUMAN" || raw === "BOTH") return raw;
    return "AI";
  } catch (error: any) {
    logger.error("[AgentSwitch] Failed to get agent type", { error, userId });
    throw error;
  }
}

/**
 * Récupère l'historique des bascules pour un utilisateur
 */
export async function getAgentSwitchHistory(
  userId: number,
  limit: number = 50
): Promise<any[]> {
  const db = getDbInstance();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const historyTable = agentSwitchHistory;

    const history = await db
      .select({
        id: historyTable.id,
        tenantId: historyTable.tenantId,
        userId: historyTable.userId,
        previousAgentType: historyTable.previousAgentType,
        newAgentType: historyTable.newAgentType,
        callId: historyTable.callId,
        triggeredBy: historyTable.triggeredBy,
        triggeredByUserId: historyTable.triggeredByUserId,
        createdAt: historyTable.createdAt,
      })
      .from(historyTable)
      .where(eq(historyTable.userId, userId))
      .limit(limit);

    return history;
  } catch (error: any) {
    logger.error("[AgentSwitch] Failed to get switch history", { error, userId });
    throw error;
  }
}

/**
 * Récupère l'historique des bascules pour un tenant
 */
export async function getTenantAgentSwitchHistory(
  tenantId: number,
  limit: number = 100
): Promise<any[]> {
  const db = getDbInstance();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const historyTable = agentSwitchHistory;

    const history = await db
      .select({
        id: historyTable.id,
        tenantId: historyTable.tenantId,
        userId: historyTable.userId,
        previousAgentType: historyTable.previousAgentType,
        newAgentType: historyTable.newAgentType,
        callId: historyTable.callId,
        triggeredBy: historyTable.triggeredBy,
        triggeredByUserId: historyTable.triggeredByUserId,
        createdAt: historyTable.createdAt,
      })
      .from(historyTable)
      .where(eq(historyTable.tenantId, tenantId))
      .limit(limit);

    return history;
  } catch (error: any) {
    logger.error("[AgentSwitch] Failed to get tenant switch history", {
      error,
      tenantId,
    });
    throw error;
  }
}