/**
 * USER SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour la gestion des utilisateurs et des membres d'équipe.
 * ✅ BLOC 4 FIX: Utilisation des erreurs standardisées
 */

import { db, users, calls, tenantUsers, type User, type InsertUser, type InsertTenantUser } from "../db";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { Errors } from "../config/appErrors";
import { logger } from "../infrastructure/logger";
import { hashPassword } from "./passwordService";
import type { Role } from "./rbacService";

export class UserService {
  /**
   * Récupère les membres d'un tenant avec pagination
   */
  static async getTenantMembers(tenantId: number) {
    return await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: tenantUsers.role,
      isActive: tenantUsers.isActive,
    })
    .from(tenantUsers)
    .innerJoin(users, eq(tenantUsers.userId, users.id))
    .where(eq(tenantUsers.tenantId, tenantId));
  }

  /**
   * Récupère un membre spécifique d'un tenant
   */
  static async getTenantMemberById(userId: number, tenantId: number) {
    const [member] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: tenantUsers.role,
      isActive: tenantUsers.isActive,
    })
    .from(tenantUsers)
    .innerJoin(users, eq(tenantUsers.userId, users.id))
    .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
    .limit(1);
    
    return member || null;
  }

  /**
   * Invite ou ajoute un membre à un tenant
   */
  static async inviteOrAddMember(tenantId: number, data: { email: string; name: string; role: Role; password?: string }) {
    let user = await this.getUserByEmail(data.email);
    
    if (!user) {
      const passwordHash = data.password ? await hashPassword(data.password) : undefined;
      const userValues: InsertUser = {
        email: data.email,
        name: data.name,
        openId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        passwordHash,
      };
      const [newUser] = await db.insert(users).values(userValues).returning();
      user = newUser;
    }

    if (!user) throw Errors.INTERNAL_ERROR("Failed to create or find user");

    // Vérifier si déjà membre
    const existingMember = await this.getTenantMemberById(user.id, tenantId);
    if (existingMember) {
      throw Errors.CONFLICT("Cet utilisateur est déjà membre de ce compte.");
    }

    const memberValues: InsertTenantUser = {
      userId: user.id,
      tenantId: tenantId,
      role: data.role,
      isActive: true,
    };
    await db.insert(tenantUsers).values(memberValues);

    logger.info("Member added to tenant", { userId: user.id, tenantId, role: data.role });

    return user;
  }

  /**
   * Met à jour un membre du tenant
   */
  static async updateMember(userId: number, tenantId: number, data: { role?: Role; isActive?: boolean }) {
    const [updated] = await db.update(tenantUsers)
      .set({
        ...(data.role ? { role: data.role } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      } as any)
      .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
      .returning();
    
    if (!updated) throw Errors.NOT_FOUND("Membre");
    
    return updated;
  }

  /**
   * Supprime un membre d'un tenant
   */
  static async removeMember(userId: number, tenantId: number) {
    const [deleted] = await db.delete(tenantUsers)
      .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
      .returning();
    
    if (!deleted) throw Errors.NOT_FOUND("Membre");
    
    return deleted;
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur
   */
  static async resetPassword(userId: number, newPassword: string) {
    const passwordHash = await hashPassword(newPassword);
    const [updated] = await db.update(users)
      .set({ passwordHash, updatedAt: new Date() } as any)
      .where(eq(users.id, userId))
      .returning();
    
    if (!updated) throw Errors.NOT_FOUND("Utilisateur");
    
    return updated;
  }

  /**
   * Récupère un utilisateur par email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  /**
   * Récupère les KPIs de performance de l'équipe
   */
  static async getTeamKPIs(tenantId: number) {
    const members = await this.getTenantMembers(tenantId);
    const activeAgents = members.filter((m) => m.role === "agent" && m.isActive).length;
    
    const [perf] = await db.select({
      avgSentimentScore: sql<number>`coalesce(avg(case when ${calls.customerSentiment} = 'positive' then 100 when ${calls.customerSentiment} = 'neutral' then 50 else 0 end), 0)::float`,
    })
    .from(calls)
    .where(eq(calls.tenantId, tenantId));

    return {
      totalMembers: members.length,
      activeAgents,
      teamPerformance: perf?.avgSentimentScore ?? 0,
      alerts: members.filter(m => !m.isActive).map(m => ({ id: m.id, type: "warning", message: `Agent ${m.name} est inactif` }))
    };
  }

  /**
   * Analyse prédictive des patterns d'agents
   */
  static async getAgentPatterns(tenantId: number, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const callStats = await db.select({
      agentId: calls.agentId,
      agentName: users.name,
      callType: calls.callType,
      outcome: calls.outcome,
      sentiment: calls.customerSentiment,
      avgDuration: sql<number>`AVG(${calls.duration})::int`,
      totalCalls: sql<number>`COUNT(*)::int`,
      successCalls: sql<number>`SUM(CASE WHEN ${calls.outcome} = 'success' THEN 1 ELSE 0 END)::int`,
    })
    .from(calls)
    .leftJoin(users, eq(calls.agentId, users.id))
    .where(and(eq(calls.tenantId, tenantId), gte(calls.createdAt, since)))
    .groupBy(calls.agentId, users.name, calls.callType, calls.outcome, calls.customerSentiment)
    .orderBy(desc(sql`count(*)`));

    return callStats;
  }
}
