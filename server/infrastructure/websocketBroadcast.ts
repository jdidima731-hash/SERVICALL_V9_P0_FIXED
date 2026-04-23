/**
 * WEBSOCKET BROADCAST — Diffusion temps réel vers le CRM
 * ─────────────────────────────────────────────────────────────────────────────
 * Permet d'envoyer des événements temps réel aux agents connectés au dashboard.
 * Utilisé par SmartTransferService pour notifier les rappels planifiés.
 * Étendu pour la supervision live (écoute/chuchotement/intervention).
 *
 * Architecture :
 *  - Map tenantId → Set<WebSocket> pour l'isolation multi-tenant
 *  - Les clients s'enregistrent via le WebSocket /crm-events
 *  - Fallback silencieux si aucun client connecté (notification différée en DB)
 */

import WebSocket from "ws";
import { logger } from "./logger";

// ── Registre des connexions CRM par tenant ─────────────────────────────────
// tenantId → Set de WebSocket clients (dashboard agents)
const crmClients = new Map<number, Set<WebSocket>>();

export interface CRMBroadcastPayload {
  type:
    // ── Rappels & Callbacks ───────────────────────────────────────────────
    | "CALLBACK_SCHEDULED"
    | "CALLBACK_CANCELLED"
    // ── Appels & Agents ───────────────────────────────────────────────────
    | "AGENT_SWITCH"
    | "LIVE_SUGGESTION"
    | "CALL_STARTED"
    | "CALL_ENDED"
    // ── Supervision Live (nouveaux types) ─────────────────────────────────
    | "AGENT_CALL_STARTED"      // Un agent a démarré un appel
    | "AGENT_CALL_ENDED"        // Un agent a terminé un appel
    | "SUPERVISION_STARTED"     // Un superviseur a commencé à écouter
    | "SUPERVISION_ENDED"       // Un superviseur a arrêté d'écouter
    | "SUPERVISION_MODE_CHANGED" // Mode supervision changé (listen/whisper/barge)
    | "ACTIVE_CALLS_UPDATED";   // Mise à jour de la liste complète des appels actifs
  data: Record<string, unknown>;
}

/**
 * Enregistre un client WebSocket dans le registre du tenant.
 * Appelé depuis index.ts lors d'une connexion /crm-events.
 */
export function registerCRMClient(tenantId: number, userIdOrWs: number | WebSocket, maybeWs?: WebSocket): void {
  const ws = typeof userIdOrWs === "number" ? maybeWs : userIdOrWs;
  const userId = typeof userIdOrWs === "number" ? userIdOrWs : undefined;

  if (!ws) {
    logger.warn("[WS Broadcast] registerCRMClient appelé sans WebSocket valide", {
      tenantId,
      userId,
    });
    return;
  }

  if (!crmClients.has(tenantId)) {
    crmClients.set(tenantId, new Set());
  }
  crmClients.get(tenantId)!.add(ws);

  // Nettoyage automatique à la déconnexion
  ws.on("close", () => {
    const clients = crmClients.get(tenantId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) crmClients.delete(tenantId);
    }
  });

  logger.info("[WS Broadcast] CRM client registered", {
    tenantId,
    userId,
    totalClients: crmClients.get(tenantId)?.size ?? 0,
  });
}

/**
 * Diffuse un message à tous les clients CRM connectés d'un tenant.
 */
export async function broadcastToTenant(
  tenantId: number,
  payload: CRMBroadcastPayload
): Promise<void> {
  const clients = crmClients.get(tenantId);

  if (!clients || clients.size === 0) {
    logger.info("[WS Broadcast] No CRM clients connected for tenant", { tenantId, type: payload.type });
    return;
  }

  const message = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        sent++;
      } catch (err: any) {
        logger.warn("[WS Broadcast] Failed to send to client", { err });
        failed++;
      }
    } else {
      // Nettoyer les connexions mortes
      clients.delete(ws);
      failed++;
    }
  }

  logger.info("[WS Broadcast] Broadcasted to tenant", {
    tenantId,
    type: payload.type,
    sent,
    failed,
  });
}

/**
 * Broadcast vers un agent spécifique (par userId).
 */
export async function broadcastToAgent(
  tenantId: number,
  userId: number,
  payload: CRMBroadcastPayload
): Promise<void> {
  const clients = crmClients.get(tenantId);
  if (!clients) return;

  const message = JSON.stringify({ ...payload, targetUserId: userId });

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        // On enrichit le message avec l'userId cible
        // Le frontend filtre côté client selon son propre userId
        ws.send(message);
      } catch {
        clients.delete(ws);
      }
    }
  }
}

/**
 * Retourne le nombre de clients CRM connectés pour un tenant.
 */
export function getConnectedCRMClients(tenantId: number): number {
  return crmClients.get(tenantId)?.size ?? 0;
}
