/**
 * =====================================================================
 * REQUEST DB CONTEXT — SERVICALL V8 — RLS HARDENING CANONICAL
 * =====================================================================
 * Ce module garantit que chaque requête HTTP dispose d'un contexte
 * transactionnel isolé avec app.user_id + app.tenant_id injectés
 * via SET LOCAL (transaction-scoped uniquement).
 *
 * RÈGLE CRITIQUE :
 *  - app.user_id + app.tenant_id sont injectés dans la MÊME transaction
 *  - SET LOCAL garantit que les valeurs ne fuient PAS entre connexions du pool
 *  - Aucun set_config global ou permissif n'est autorisé
 * =====================================================================
 */
import { sql } from "drizzle-orm";
import { dbManager } from "./dbManager";
import { logger } from "../infrastructure/logger";

export interface RLSContext {
  userId: number;
  tenantId: number;
}

/**
 * Valide que userId et tenantId sont des entiers positifs valides.
 * Lève une erreur explicite en cas de valeur invalide.
 */
function validateRLSContext(ctx: RLSContext): void {
  if (!Number.isInteger(ctx.userId) || ctx.userId <= 0) {
    throw new Error(`RLS_CONTEXT_ERROR: Invalid userId "${ctx.userId}". Must be a positive integer.`);
  }
  if (!Number.isInteger(ctx.tenantId) || ctx.tenantId <= 0) {
    throw new Error(`RLS_CONTEXT_ERROR: Invalid tenantId "${ctx.tenantId}". Must be a positive integer.`);
  }
}

/**
 * Exécute un callback dans une transaction isolée avec le contexte RLS injecté.
 *
 * - Utilise SET LOCAL pour scoper app.user_id et app.tenant_id à la transaction
 * - Garantit fail-closed : si l'injection échoue, la transaction est annulée
 * - Compatible avec le pooling de connexions (pas de persistance inter-requêtes)
 */
export async function withRequestContext<T>(
  ctx: RLSContext,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  validateRLSContext(ctx);

  const db = dbManager.db;

  return await db.transaction(async (tx: any) => {
    // Injection atomique dans la même transaction (SET LOCAL = transaction-scoped)
    await tx.execute(sql`SET LOCAL app.user_id = ${ctx.userId.toString()}`);
    await tx.execute(sql`SET LOCAL app.tenant_id = ${ctx.tenantId.toString()}`);

    logger.debug("[RLS] Context injected via SET LOCAL", {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
    });

    try {
      const result = await callback(tx);
      return result;
    } catch (error: unknown) {
      logger.error("[RLS] Transaction failed — rolling back", {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

/**
 * Exécute un callback dans une transaction bootstrap (sans tenant_id).
 * Utilisé UNIQUEMENT pour getUserTenants() lors de l'authentification initiale.
 *
 * - Seul app.user_id est injecté
 * - app.tenant_id n'est PAS défini (la politique RLS tenant_users utilise user_id)
 * - Fail-closed : si userId invalide, la transaction est bloquée
 */
export async function withBootstrapContext<T>(
  userId: number,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`RLS_CONTEXT_ERROR: Invalid userId "${userId}" for bootstrap context.`);
  }

  const db = dbManager.db;

  return await db.transaction(async (tx: any) => {
    await tx.execute(sql`SET LOCAL app.user_id = ${userId.toString()}`);

    logger.debug("[RLS] Bootstrap context injected (user_id only)", { userId });

    try {
      return await callback(tx);
    } catch (error: unknown) {
      logger.error("[RLS] Bootstrap transaction failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}
