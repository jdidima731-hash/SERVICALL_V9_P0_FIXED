/**
 * MIDDLEWARE DE NORMALISATION DES RÉPONSES API
 * ✅ Réponses API typées et normalisées
 * ✅ Codes erreurs standardisés
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

// ============================================
// TYPES DE RÉPONSES NORMALISÉES
// ============================================

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// CODES D'ERREUR STANDARDISÉS
// ============================================

export const API_ERROR_CODES = {
  // Erreurs client (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  
  // Erreurs serveur (5xx)
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  
  // Erreurs métier
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  RESOURCE_LOCKED: "RESOURCE_LOCKED",
  OPERATION_TIMEOUT: "OPERATION_TIMEOUT",
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

// ============================================
// MAPPING TRPC ERROR -> HTTP STATUS
// ============================================

export const TRPC_ERROR_TO_HTTP_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Créer une réponse de succès normalisée
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Partial<NonNullable<ApiSuccessResponse["meta"]>>
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: meta?.requestId,
      pagination: meta?.pagination,
    },
  };
}

/**
 * Créer une réponse d'erreur normalisée
 */
export function createErrorResponse(
  code: ApiErrorCode | string,
  message: string,
  details?: any,
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Convertir une TRPCError en réponse d'erreur normalisée
 */
export function trpcErrorToApiError(
  error: TRPCError,
  requestId?: string
): ApiErrorResponse {
  const code = error.code ?? "INTERNAL_SERVER_ERROR";
  const message = error.message || "Une erreur est survenue";
  
  logger.error("[API] TRPC Error", {
    code,
    message,
    requestId,
    cause: error.cause,
  });

  return createErrorResponse(code, message, error.cause, requestId);
}

/**
 * Middleware pour normaliser les réponses
 */
export function createResponseNormalizerMiddleware() {
  return async (opts: any) => {
    const { next, ctx } = opts;
    
    try {
      const result = await next();
      
      // Si le résultat est déjà normalisé, le retourner tel quel
      if (result && typeof result === "object" && "success" in result) {
        return result;
      }
      
      // Sinon, normaliser la réponse
      return createSuccessResponse(result, undefined, {
        requestId: ctx.correlationId,
      });
    } catch (error: any) {
      // Convertir l'erreur en réponse normalisée
      if (error instanceof TRPCError) {
        throw error; // Laisser tRPC gérer ses propres erreurs
      }
      
      logger.error("[API] Unexpected error in response normalizer", {
        error,
        requestId: ctx.correlationId,
      });
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Une erreur inattendue est survenue",
        cause: error,
      });
    }
  };
}

/**
 * Wrapper pour créer des réponses paginées
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number,
  message?: string
): ApiSuccessResponse<T[]> {
  return createSuccessResponse(data, message, {
    pagination: {
      total,
      limit,
      offset,
    },
  });
}

/**
 * Valider et normaliser les erreurs de validation Zod
 */
export function handleZodError(error: any): never {
  const issues = error.issues || [];
  const details = issues.map((issue: any) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Erreur de validation des données",
    cause: { validationErrors: details },
  });
}

/**
 * Créer une erreur métier standardisée
 */
export function createBusinessError(
  code: ApiErrorCode,
  message: string,
  details?: any): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message,
    cause: { businessError: code, details },
  });
}
