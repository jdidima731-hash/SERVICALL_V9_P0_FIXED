/**
 * CORRELATION ID MIDDLEWARE
 * ✅ ID de requête global pour traçabilité complète
 * ✅ Propagation dans tous les logs et services
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logContext as logStore } from "../infrastructure/logger";

/**
 * Middleware Express pour générer et propager un correlation ID
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Générer ou récupérer le correlation ID
  const correlationId =
    (req.headers["x-correlation-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    `req_${randomUUID()}`;

  // Attacher au contexte de la requête (typé via global.d.ts)
  req.correlationId = correlationId;

  // Ajouter dans les headers de réponse pour traçabilité
  res.setHeader("X-Correlation-ID", correlationId);

  // Créer un store AsyncLocalStorage pour cette requête
  const store = new Map<string, unknown>();
  store.set("correlationId", correlationId);
  store.set("userId", req.user?.id);
  store.set("tenantId", req.tenantId);

  // Exécuter la suite dans le contexte du store
  logStore.run(store, () => {
    next();
  });
}

/**
 * Middleware tRPC pour propager le correlation ID
 */
export function createTrpcCorrelationMiddleware() {
  return async (opts: {
    ctx: Record<string, unknown>;
    next: (args: { ctx: Record<string, unknown> }) => Promise<unknown>;
  }) => {
    const { ctx, next } = opts;

    // Récupérer ou générer le correlation ID
    const correlationId =
      (ctx["correlationId"] as string | undefined) ||
      ((ctx["req"] as Request | undefined)?.correlationId) ||
      `trpc_${randomUUID()}`;

    // Créer un store pour cette requête tRPC
    const store = new Map<string, unknown>();
    store.set("correlationId", correlationId);
    store.set("userId", (ctx["user"] as { id?: number } | undefined)?.id);
    store.set("tenantId", ctx["tenantId"]);

    // Exécuter dans le contexte du store
    return logStore.run(store, async () => {
      return next({
        ctx: {
          ...ctx,
          correlationId,
        },
      });
    });
  };
}

/**
 * Récupérer le correlation ID du contexte actuel
 */
export function getCorrelationId(): string | undefined {
  const store = logStore.getStore();
  return store?.get("correlationId") as string | undefined;
}

/**
 * Récupérer le tenant ID du contexte actuel
 */
export function getCurrentTenantId(): number | undefined {
  const store = logStore.getStore();
  return store?.get("tenantId") as number | undefined;
}

/**
 * Récupérer le user ID du contexte actuel
 */
export function getCurrentUserId(): number | undefined {
  const store = logStore.getStore();
  return store?.get("userId") as number | undefined;
}
