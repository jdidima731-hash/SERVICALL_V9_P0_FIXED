/**
 * Application Errors — Gestion centralisée et standardisée
 * ✅ BLOC 4 FIX: Typage strict et gestion des erreurs unifiée
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * ✅ Classe de base pour les erreurs applicatives
 */
export class AppError extends TRPCError {
  constructor(
    code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR",
    message: string,
    cause?: unknown
  ) {
    super({ code, message });
    if (cause) {
      const causeMessage = cause instanceof Error ? cause.message : String(cause);
      const causeStack = cause instanceof Error ? cause.stack : undefined;
      
      logger.error("[AppError]", {
        code,
        message,
        cause: causeMessage,
        stack: causeStack,
      });
    }
  }
}

/**
 * ✅ Erreurs prédéfinies et réutilisables
 */
export const Errors = {
  UNAUTHORIZED: () =>
    new AppError("UNAUTHORIZED", "Authentification requise"),

  FORBIDDEN: (resource?: string) =>
    new AppError("FORBIDDEN", `Accès refusé${resource ? ` à ${resource}` : ""}`),

  NOT_FOUND: (resource: string) =>
    new AppError("NOT_FOUND", `${resource} non trouvé`),

  INVALID_INPUT: (field: string, reason?: string) =>
    new AppError("BAD_REQUEST", `${field} invalide${reason ? ` : ${reason}` : ""}`),

  INVALID_TENANT: () =>
    new AppError("FORBIDDEN", "Contexte d'entreprise invalide"),

  CONFLICT: (message: string) =>
    new AppError("CONFLICT", message),

  TOO_MANY_REQUESTS: () =>
    new AppError("TOO_MANY_REQUESTS", "Trop de requêtes. Veuillez ralentir."),

  INTERNAL_ERROR: (cause?: unknown) =>
    new AppError("INTERNAL_SERVER_ERROR", "Une erreur interne s'est produite", cause),

  DATABASE_ERROR: (cause?: unknown) =>
    new AppError("INTERNAL_SERVER_ERROR", "Erreur de base de données", cause),

  EXTERNAL_SERVICE_ERROR: (service: string, cause?: unknown) =>
    new AppError("INTERNAL_SERVER_ERROR", `Erreur du service ${service}`, cause),

  VALIDATION_ERROR: (errors: Record<string, string>) => {
    const message = Object.entries(errors)
      .map(([field, error]) => `${field}: ${error}`)
      .join("; ");
    return new AppError("BAD_REQUEST", `Validation échouée: ${message}`);
  },

  TRANSACTION_FAILED: (cause?: unknown) =>
    new AppError("INTERNAL_SERVER_ERROR", "Transaction échouée", cause),

  RESOURCE_EXHAUSTED: (resource: string) =>
    new AppError("CONFLICT", `${resource} épuisé`),
};

/**
 * ✅ Gestionnaire d'erreurs global
 */
export function handleError(error: unknown, context?: Record<string, unknown>): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof TRPCError) {
    return new AppError(error.code, error.message, error.cause);
  }

  if (error instanceof Error) {
    logger.error("[ErrorHandler] Unhandled error", {
      message: error.message,
      stack: error.stack,
      context,
    });

    if (error.message.includes("database") || error.message.includes("query")) {
      return Errors.DATABASE_ERROR(error);
    }

    if (error.message.includes("validation")) {
      return Errors.INVALID_INPUT("input", error.message);
    }

    return Errors.INTERNAL_ERROR(error);
  }

  logger.error("[ErrorHandler] Unknown error type", { error, context });
  return Errors.INTERNAL_ERROR(error);
}

/**
 * ✅ Middleware global pour capturer les erreurs (Typage strict)
 */
export const createErrorMiddleware = (t: any) => {
  return t.middleware(async ({ next, path, type }: { next: () => Promise<any>, path: string, type: string }) => {
    try {
      return await next();
    } catch (error: unknown) {
      if (error instanceof TRPCError) {
        throw error;
      }

      const appError = handleError(error, {
        path,
        type,
      });

      throw appError;
    }
  });
};
