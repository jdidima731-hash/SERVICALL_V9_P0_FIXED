/**
 * CALL SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour la gestion des appels.
 * ✅ BLOC 2 FIX: Architecture API -> Service -> Domain -> Infra
 */

import { db, calls } from "../db";
import { eq, and, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

export class CallService {
  /**
   * Liste les appels d'un tenant avec pagination
   */
  static async list(tenantId: number, limit: number, offset: number) {
    const [data, totalResult] = await Promise.all([
      db.select().from(calls)
        .where(eq(calls.tenantId, tenantId))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(calls.createdAt)),
      db.select({ value: count() })
        .from(calls)
        .where(eq(calls.tenantId, tenantId))
    ]);
    
    return { data, total: totalResult[0]?.value ?? 0 };
  }

  /**
   * Récupère un appel par son ID
   */
  static async getById(callId: number, tenantId: number) {
    const [call] = await db.select().from(calls)
      .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
      .limit(1);
    return call || null;
  }

  /**
   * Crée un nouvel appel
   */
  static async create(tenantId: number, agentId: number, data: any) {
    const [newCall] = await db.insert(calls).values({
      tenantId,
      agentId,
      ...data,
      startedAt: new Date(),
    }).returning();
    return newCall;
  }

  /**
   * Met à jour un appel
   */
  static async update(callId: number, tenantId: number, data: any) {
    const [updated] = await db.update(calls)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
      .returning();
    return updated;
  }

  /**
   * Supprime un appel
   */
  static async delete(callId: number, tenantId: number) {
    const [deleted] = await db.delete(calls)
      .where(and(eq(calls.id, callId), eq(calls.tenantId, tenantId)))
      .returning();
    return deleted;
  }

  /**
   * Compte les appels en attente ou manqués
   */
  static async countPending(tenantId: number, agentId?: number) {
    const conditions = [
      eq(calls.tenantId, tenantId),
      sql`${calls.status} IN ('scheduled', 'missed')`
    ];
    if (agentId) conditions.push(eq(calls.agentId, agentId));

    const [result] = await db.select({ value: count() })
      .from(calls)
      .where(and(...conditions));
    
    return result?.value ?? 0;
  }
}

// Helper pour le SQL brut si nécessaire
import { sql } from "drizzle-orm";
