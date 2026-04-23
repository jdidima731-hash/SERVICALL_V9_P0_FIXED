/**
 * GLOBAL MIDDLEWARE
 * ✅ Isolation tenant stricte
 * ✅ Gestion d'erreurs centralisée
 * ✅ Sécurité renforcée
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { logger } from "../infrastructure/logger";
import { extractTenantContext } from "../services/tenantService";

/**
 * Middleware d'isolation tenant global pour Express
 */
export async function tenantIsolationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenantContext = await extractTenantContext(req);

    if (tenantContext) {
      // req.tenantId et req.tenantContext sont déclarés dans server/types/global.d.ts
      req.tenantId = tenantContext.tenantId;
      req.tenantContext = tenantContext;
    }

    // Protection spécifique pour les routes /api/tenant/*
    if (req.path.startsWith("/api/tenant/") && !tenantContext) {
      res.status(403).json({
        success: false,
        error: "Accès refusé : Contexte entreprise (tenantId) manquant.",
      });
      return;
    }

    next();
  } catch (error: any) {
    logger.error("[TenantIsolation] Critical error", { error });
    res.status(500).json({
      success: false,
      error: "Erreur interne lors de la résolution du contexte entreprise.",
    });
  }
}

/**
 * Gestionnaire d'erreurs global pour Express (4 arguments = ErrorRequestHandler).
 * Le type ErrorRequestHandler garantit la compatibilité avec app.use() (TS2769).
 */
export const globalErrorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // correlationId est déclaré sur Express.Request dans global.d.ts (TS4111 résolu)
  const correlationId = req.correlationId ?? "unknown";

  // Accès sécurisé aux propriétés non standard de l'erreur (TS18046 résolu)
  const errObj = err as Record<string, unknown>;
  const statusCode =
    (typeof errObj["status"] === "number" ? errObj["status"] : undefined) ??
    (typeof errObj["statusCode"] === "number" ? errObj["statusCode"] : undefined) ??
    500;
  const errorCode =
    (typeof errObj["code"] === "string" ? errObj["code"] : undefined) ??
    "INTERNAL_SERVER_ERROR";
  const errorMessage =
    err instanceof Error ? err.message : String(err);

  logger.error("[GlobalError] Unhandled exception", {
    error: errorMessage,
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
    correlationId,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message:
        process.env["NODE_ENV"] === "production"
          ? "Une erreur interne est survenue."
          : errorMessage,
      correlationId,
    },
  });
};

/**
 * Wrapper pour capturer les rejets de promesses non gérés dans les routes Express.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
