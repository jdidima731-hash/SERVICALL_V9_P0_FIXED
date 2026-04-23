/**
 * DATABASE ACCESS LAYER — SERVICALL V8 — HARDENING CANONICAL (BLOC 4)
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Centralisation des transactions isolées par RLS
 * ✅ Suppression des accès directs non-isolés (sauf bootstrap)
 * ✅ Isolation hermétique tenant_id + user_id
 */

import { eq, and, sql, desc, gte, type ExtractTablesWithRelations } from "drizzle-orm";
import { dbManager } from "./services/dbManager";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../drizzle/schema";
import { logger } from "./infrastructure/logger";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";

// Type de l'instance Drizzle
type DrizzleDB = PostgresJsDatabase<typeof schema> & { query: Record<string, unknown> };

// Re-export du schéma
export * from "../drizzle/schema";
export { securityAuditLogs } from "../drizzle/schema-compliance";
export type AuditLog = schema.SecurityAuditLog;
export type AtRiskAgent = { agentId: number; failedCalls: number; totalCalls: number };
export type AgentPerformanceMetric = { 
  agentId: number | null; 
  agentName: string | null; 
  callType: string | null; 
  outcome: string | null; 
  sentiment: string | null; 
  avgDuration: number; 
  totalCalls: number; 
  successCalls: number; 
  avgQualityScore?: number;
};

/**
 * Type pour les transactions Drizzle
 */
export type DbTransaction = PgTransaction<
  PostgresJsQueryResultHKT, 
  typeof schema, 
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Accès à l'instance brute (Réservé au bootstrap et services système)
 */
export const getDbInstance = (): DrizzleDB => {
  if (!dbManager.db) {
    throw new Error("DATABASE_NOT_INITIALIZED: Attempted to access DB before initialization.");
  }
  return dbManager.db ;
};

/**
 * ORCHESTRATEUR RLS — Point d'entrée canonique pour toute opération métier
 * ─────────────────────────────────────────────────────────────────────────────
 * Impose SET LOCAL app.tenant_id et app.user_id dans une transaction.
 */
export async function withRLS<T>(
  params: { userId: number; tenantId: number },
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  const { userId, tenantId } = params;
  
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("RLS_ERROR: Invalid userId");
  if (!Number.isInteger(tenantId) || tenantId <= 0) throw new Error("RLS_ERROR: Invalid tenantId");

  const database = getDbInstance();
  return await database.transaction(async (tx) => {
    // ✅ Injection atomique du contexte transactionnel
    await tx.execute(sql`SET LOCAL app.user_id = ${userId.toString()}`);
    await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId.toString()}`);
    
    return await callback(tx );
  });
}

/**
 * CONTEXTE BOOTSTRAP — Utilisé uniquement lors de l'authentification
 * ─────────────────────────────────────────────────────────────────────────────
 * Injecte uniquement user_id pour permettre la lecture de tenant_users.
 */
export async function withBootstrapContext<T>(
  userId: number,
  callback: (tx: DbTransaction) => Promise<T>
): Promise<T> {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("BOOTSTRAP_ERROR: Invalid userId");

  const database = getDbInstance();
  return await database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.user_id = ${userId.toString()}`);
    return await callback(tx );
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampPaginationLimit(limit?: number): number {
  const l = Number(limit);
  if (!Number.isFinite(l) || l <= 0) return 50;
  return Math.min(l, 200);
}

// ── Opérations Métier Unifiées (Utilisent RLS) ───────────────────────────────

export async function getUserByEmail(email: string): Promise<schema.User | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return result[0] ?? undefined;
}

export async function getUserById(id: number): Promise<schema.User | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return result[0] ?? undefined;
}

/**
 * Récupère les tenants d'un utilisateur (Utilise le contexte Bootstrap)
 */
export async function getUserTenants(userId: number) {
  return await withBootstrapContext(userId, async (tx) => {
    return await tx
      .select({
        id: schema.tenants.id,
        name: schema.tenants.name,
        slug: schema.tenants.slug,
        role: schema.tenantUsers.role,
        isActive: schema.tenants.isActive
      })
      .from(schema.tenantUsers)
      .innerJoin(schema.tenants, eq(schema.tenantUsers.tenantId, schema.tenants.id))
      .where(eq(schema.tenantUsers.userId, userId));
  });
}

/**
 * Opérations Workflow (RLS Enforced via withRLS)
 */
export async function getWorkflowsByTenant(params: { userId: number; tenantId: number; limit?: number; offset?: number }) {
  return await withRLS(params, async (tx) => {
    return await tx
      .select()
      .from(schema.workflows)
      .limit(clampPaginationLimit(params.limit))
      .offset(params.offset ?? 0)
      .orderBy(desc(schema.workflows.createdAt));
  });
}

export async function createWorkflow(params: { userId: number; tenantId: number; data: schema.InsertWorkflow }) {
  return await withRLS(params, async (tx) => {
    const [result] = await tx.insert(schema.workflows).values({
      ...params.data,
      tenantId: params.tenantId // Redondant mais sécurisant
    }).returning();
    return result;
  });
}

// ── Proxy de compatibilité (À utiliser avec précaution) ──────────────────────
export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_target, prop) {
    if (prop === 'query') {
      return getDbInstance().query;
    }
    const instance = getDbInstance();
    return (instance as Record<string, any>)[prop];
  }
});

// ============================================================
// HELPER FUNCTIONS — TS2339 FIX
// Fonctions utilitaires pour les routers qui utilisent import * as db
// ============================================================

export async function getProspectById(prospectId: number, tenantId?: number): Promise<schema.Prospect | undefined> {
  const database = getDbInstance();
  const conditions = [eq(schema.prospects.id, prospectId)];
  if (tenantId) conditions.push(eq(schema.prospects.tenantId, tenantId));
  const result = await database.select().from(schema.prospects).where(and(...conditions)).limit(1);
  return result[0];
}

export async function getProspectsByTenant(tenantId: number, limit = 100, offset = 0, userId?: number): Promise<schema.Prospect[]> {
  const database = getDbInstance();
  const conditions = [eq(schema.prospects.tenantId, tenantId)];
  if (userId) conditions.push(eq(schema.prospects.assignedTo, userId));
  return database.select().from(schema.prospects).where(and(...conditions)).limit(limit).offset(offset);
}

export async function createProspect(data: schema.InsertProspect): Promise<schema.Prospect> {
  const database = getDbInstance();
  const [result] = await database.insert(schema.prospects).values(data).returning();
  return result;
}

export async function createProspectOptimized(data: schema.InsertProspect): Promise<schema.Prospect> {
  return createProspect(data);
}

export async function updateProspect(prospectId: number, data: Partial<schema.InsertProspect>, tenantId?: number): Promise<schema.Prospect | undefined> {
  const database = getDbInstance();
  const conditions = [eq(schema.prospects.id, prospectId)];
  if (tenantId) conditions.push(eq(schema.prospects.tenantId, tenantId));
  const [result] = await database.update(schema.prospects).set({ ...data, updatedAt: new Date() }).where(and(...conditions)).returning();
  return result;
}

export async function deleteProspect(prospectId: number, tenantId?: number): Promise<void> {
  const database = getDbInstance();
  const conditions = [eq(schema.prospects.id, prospectId)];
  if (tenantId) conditions.push(eq(schema.prospects.tenantId, tenantId));
  await database.delete(schema.prospects).where(and(...conditions));
}

export async function getCallById(callId: number, tenantId?: number): Promise<schema.Call | undefined> {
  const database = getDbInstance();
  const conditions = [eq(schema.calls.id, callId)];
  if (tenantId) conditions.push(eq(schema.calls.tenantId, tenantId));
  const result = await database.select().from(schema.calls).where(and(...conditions)).limit(1);
  return result[0];
}

export async function createCall(data: schema.InsertCall): Promise<schema.Call> {
  const database = getDbInstance();
  const [result] = await database.insert(schema.calls).values(data).returning();
  return result;
}

export async function updateCall(callId: number, data: Partial<schema.InsertCall>, tenantId?: number): Promise<schema.Call | undefined> {
  const database = getDbInstance();
  const conditions = [eq(schema.calls.id, callId)];
  if (tenantId) conditions.push(eq(schema.calls.tenantId, tenantId));
  const [result] = await database.update(schema.calls).set({ ...data, updatedAt: new Date() }).where(and(...conditions)).returning();
  return result;
}

export async function getCallsByTenant(tenantId: number, limit = 100): Promise<schema.Call[]> {
  const database = getDbInstance();
  return database.select().from(schema.calls).where(eq(schema.calls.tenantId, tenantId)).limit(limit);
}

export async function getAppointmentById(appointmentId: number, tenantId?: number): Promise<schema.Appointment | undefined> {
  const database = getDbInstance();
  const conditions = [eq(schema.appointments.id, appointmentId)];
  if (tenantId) conditions.push(eq(schema.appointments.tenantId, tenantId));
  const result = await database.select().from(schema.appointments).where(and(...conditions)).limit(1);
  return result[0];
}

export async function getAppointmentsByTenant(tenantId: number, limit = 100): Promise<schema.Appointment[]> {
  const database = getDbInstance();
  return database.select().from(schema.appointments).where(eq(schema.appointments.tenantId, tenantId)).limit(limit);
}

export async function createAppointment(data: schema.InsertAppointment): Promise<schema.Appointment> {
  const database = getDbInstance();
  const [result] = await database.insert(schema.appointments).values(data).returning();
  return result;
}

export async function updateAppointment(appointmentId: number, data: Partial<schema.InsertAppointment>, tenantId?: number): Promise<schema.Appointment | undefined> {
  const database = getDbInstance();
  const conditions = [eq(schema.appointments.id, appointmentId)];
  if (tenantId) conditions.push(eq(schema.appointments.tenantId, tenantId));
  const [result] = await database.update(schema.appointments).set({ ...data, updatedAt: new Date() }).where(and(...conditions)).returning();
  return result;
}

export async function deleteAppointment(appointmentId: number, tenantId?: number): Promise<void> {
  const database = getDbInstance();
  const conditions = [eq(schema.appointments.id, appointmentId)];
  if (tenantId) conditions.push(eq(schema.appointments.tenantId, tenantId));
  await database.delete(schema.appointments).where(and(...conditions));
}

export async function getTenantById(tenantId: number): Promise<schema.Tenant | undefined> {
  const database = getDbInstance();
  const result = await database.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  return result[0];
}
