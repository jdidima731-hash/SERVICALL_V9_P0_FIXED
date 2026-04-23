/**
 * Database Extensions for Role-Based Filtering
 * These functions extend the base db.ts with role-aware filtering
 */

import { eq, and } from "drizzle-orm";
import * as db from "./db";
import { calls, appointments, tasks } from "../drizzle/schema";

// ============================================
// PROSPECT FILTERING BY ROLE
// ============================================

/**
 * Get prospects filtered by agent (agent can only see their own prospects)
 * Note: This is a simplified implementation. In production, you'd need to track
 * which agent created or is assigned to each prospect.
 */
// ✅ FIX M2 — AVERTISSEMENT : ces fonctions ignorent agentId/managerId car le schéma
// ne dispose pas encore de table de hiérarchie d'équipe. Elles retournent TOUS les
// prospects du tenant. NE PAS les utiliser pour du contrôle d'accès fin côté agent.
// Filtre réel à activer lorsque la table team_memberships fera partie du périmètre déployé.
export async function getProspectsByAgent(tenantId: number, _agentId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];
  // ⚠️ filtre agentId non implémenté — retourne tous les prospects du tenant
  return await db.getProspectsByTenant(tenantId);
}

/**
 * Get prospects filtered by manager (manager can see team prospects)
 * ⚠️ filtre managerId non implémenté — retourne tous les prospects du tenant
 */
export async function getProspectsByManager(tenantId: number, _managerId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];
  return await db.getProspectsByTenant(tenantId);
}

// ============================================
// CALL FILTERING BY ROLE
// ============================================

/**
 * Get calls filtered by agent (agent can only see their own calls)
 */
export async function getCallsByAgent(tenantId: number, agentId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];

  return await dbInstance
    .select()
    .from(calls)
    .where(and(eq(calls.tenantId, tenantId), eq(calls.agentId, agentId)));
}

/**
 * Get calls filtered by manager (manager can see team calls)
 */
export async function getCallsByManager(tenantId: number, _managerId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant calls
  return await db.getCallsByTenant(tenantId);
}

// ============================================
// APPOINTMENT FILTERING BY ROLE
// ============================================

/**
 * Get appointments filtered by agent (agent can only see their own appointments)
 */
export async function getAppointmentsByAgent(tenantId: number, agentId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];

  return await dbInstance
    .select()
    .from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), eq(appointments.userId, agentId)));
}

/**
 * Get appointments filtered by manager (manager can see team appointments)
 */
export async function getAppointmentsByManager(tenantId: number, _managerId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant appointments
  return await db.getAppointmentsByTenant(tenantId);
}

// ============================================
// TASK FILTERING BY ROLE
// ============================================

/**
 * Get tasks filtered by agent (agent can only see their assigned tasks)
 */
export async function getTasksByAgent(tenantId: number, agentId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];

  return await dbInstance
    .select()
    .from(tasks)
    .where(and(eq(tasks.tenantId, tenantId), eq(tasks.assignedTo, agentId)));
}

/**
 * Get tasks filtered by manager (manager can see team tasks)
 */
export async function getTasksByManager(tenantId: number, _managerId: number) {
  const dbInstance = db.getDbInstance();
  if (!dbInstance) return [];

  // Note: Team structure filtering requires team hierarchy in schema
  // Current implementation returns all tenant tasks
  return await dbInstance
    .select()
    .from(tasks)
    .where(eq(tasks.tenantId, tenantId));
}
