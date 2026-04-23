/**
 * =====================================================================
 * RLS MIDDLEWARE — SERVICALL V8 — HARDENING CANONICAL (BLOC 4)
 * =====================================================================
 * Applique le contexte RLS (app.user_id + app.tenant_id) via SET LOCAL
 * dans une transaction isolée par requête.
 *
 * CONTRAINTES ABSOLUES :
 *  ❌ Aucun set_config permissif ou global
 *  ❌ Aucun current_setting(..., true) pour fallback silencieux
 *  ✅ SET LOCAL uniquement (transaction-scoped)
 *  ✅ Fail-closed : accès refusé si contexte manquant
 * =====================================================================
 */
import { Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { getDbInstance } from "../db";
import { logger } from "../infrastructure/logger";

/**
 * Injecte app.user_id et app.tenant_id via SET LOCAL dans une transaction.
 */
export async function setRLSContextInTransaction(
  tx: any,
  userId: number,
  tenantId: number
): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`RLS_ERROR: Invalid userId "${userId}". Access denied.`);
  }
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw new Error(`RLS_ERROR: Invalid tenantId "${tenantId}". Access denied.`);
  }
  
  // ✅ SET LOCAL est transaction-scoped : pas de pollution entre requêtes
  await tx.execute(sql`SET LOCAL app.user_id = ${userId.toString()}`);
  await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId.toString()}`);
  
  logger.debug("[RLS] Context injected into transaction", { userId, tenantId });
}

/**
 * Wrapper transactionnel avec isolation complète.
 * Toute opération DB dans le callback sera filtrée par les policies RLS.
 */
export async function withTenantContext<T>(
  userId: number,
  tenantId: number,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const db = getDbInstance();
  return await db.transaction(async (tx: any) => {
    await setRLSContextInTransaction(tx, userId, tenantId);
    return await callback(tx);
  });
}

/**
 * Middleware Express : Validation du contexte avant exécution.
 * Ce middleware ne fait que VALIDER. L'application effective du RLS
 * se fait dans la couche DB (db.ts) via withTenantContext.
 */
export function rlsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Les propriétés tenantId et userId sont injectées par l'auth middleware
  const tenantId = req.tenantId;
  const userId = req.userId;

  // Routes publiques (sans auth)
  if (!tenantId && !userId) {
    return next();
  }

  // Fail-closed : si on a l'un mais pas l'autre sur une route protégée
  if (!tenantId || !userId) {
    logger.error("[RLS] Incomplete context on protected route", { path: req.path, tenantId, userId });
    res.status(403).json({ 
      error: "FORBIDDEN", 
      message: "Security context incomplete. Access denied." 
    });
    return;
  }

  // Validation des types
  if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    logger.error("[RLS] Invalid context values", { tenantId, userId, path: req.path });
    res.status(403).json({ error: "FORBIDDEN", message: "Invalid security context." });
    return;
  }

  next();
}
