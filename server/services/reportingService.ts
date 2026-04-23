/**
 * REPORTING SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour la génération de rapports et statistiques.
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 */

import { db, calls, users, appointments } from "../db";
import { eq, and, sql, desc } from "drizzle-orm";

export class ReportingService {
  /**
   * Récupère les statistiques d'appels pour un tenant sur une période donnée
   */
  static async getCallStats(tenantId: number, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return await db.select({
      totalCalls: sql<number>`count(${calls.id})::int`,
      avgDuration: sql<number>`coalesce(avg(${calls.duration}), 0)::int`,
      avgQualityScore: sql<number>`coalesce(avg(${calls.qualityScore}), 0)::float`,
      status: calls.status,
    })
    .from(calls)
    .where(and(
      eq(calls.tenantId, tenantId),
      sql`${calls.createdAt} >= ${start}`,
      sql`${calls.createdAt} <= ${end}`
    ))
    .groupBy(calls.status);
  }

  /**
   * Récupère la performance des agents pour un tenant
   */
  static async getAgentPerformance(tenantId: number, params: { agentId?: number; timeRange: "7d" | "30d" | "90d" }) {
    const days = params.timeRange === "7d" ? 7 : params.timeRange === "30d" ? 30 : 90;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    return await db.select({
      agentId: calls.agentId,
      agentName: users.name,
      totalCalls: sql<number>`count(${calls.id})::int`,
      avgScore: sql<number>`coalesce(avg(${calls.qualityScore}), 0)::float`,
      totalAppointments: sql<number>`count(${appointments.id})::int`,
    })
    .from(calls)
    .leftJoin(users, eq(calls.agentId, users.id))
    .leftJoin(appointments, and(
      eq(appointments.agentId, calls.agentId),
      eq(appointments.tenantId, tenantId)
    ))
    .where(and(
      eq(calls.tenantId, tenantId),
      sql`${calls.createdAt} >= ${since}`,
      params.agentId ? eq(calls.agentId, params.agentId) : sql`true`
    ))
    .groupBy(calls.agentId, users.name);
  }

  /**
   * Exporte les données d'appels pour un tenant
   */
  static async exportCallData(tenantId: number, limit: number = 1000) {
    return await db.select()
      .from(calls)
      .where(eq(calls.tenantId, tenantId))
      .limit(limit)
      .orderBy(desc(calls.createdAt));
  }
}
