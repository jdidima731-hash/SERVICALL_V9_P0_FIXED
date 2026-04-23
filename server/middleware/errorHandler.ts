/**
 * Global Error Handler Middleware
 * Centralized error handling for Express and tRPC
 * ✅ BLOC 4 FIX: Uniformisation avec AppError et logging structuré
 */

import { TRPCError } from "@trpc/server";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger";
import { ZodError } from "zod";
import { v4 as uuidv4 } from "uuid";
import { setTag, setExtra, captureException as sentryCaptureException } from "@sentry/node";
import { AppError, handleError } from "../config/appErrors";

/**
 * Error types (Source unique de vérité pour le frontend)
 */
export enum ErrorType {
  VALIDATION = "VALIDATION_ERROR",
  AUTHENTICATION = "AUTHENTICATION_ERROR",
  AUTHORIZATION = "AUTHORIZATION_ERROR",
  CSRF = "CSRF_ERROR",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  RATE_LIMIT = "RATE_LIMIT_EXCEEDED",
  INTERNAL = "INTERNAL_ERROR",
  EXTERNAL_API = "EXTERNAL_API_ERROR",
  DATABASE = "DATABASE_ERROR",
}

/**
 * Convert various error types to standardized format
 */
export function normalizeError(error: unknown): {
  type: ErrorType;
  message: string;
  statusCode: number;
  details?: unknown;
  stack?: string;
} {
  // Utiliser le gestionnaire centralisé pour obtenir une AppError
  const appError = handleError(error);
  
  const statusCode = getTRPCStatusCode(appError.code);
  const type = mapTRPCCodeToErrorType(appError.code);

  const normalized: {
    type: ErrorType;
    message: string;
    statusCode: number;
    details: unknown;
    stack: string | undefined;
  } = {
    type,
    message: appError.message,
    statusCode,
    details: appError.cause as unknown,
    stack: appError.stack,
  };

  // Cas particuliers non couverts par AppError/TRPCError de base
  if (error instanceof Error && ((error as any).code === "EBADCSRF" || error.message === "invalid csrf token")) {
    normalized.type = ErrorType.CSRF;
    normalized.message = "La vérification de sécurité (CSRF) a échoué. Veuillez rafraîchir la page.";
    normalized.statusCode = 403;
  } else if (error instanceof ZodError) {
    normalized.type = ErrorType.VALIDATION;
    normalized.message = "Données invalides";
    normalized.statusCode = 400;
    normalized.details = error.issues;
  }

  // Masquer la stack trace en production
  if (process.env['NODE_ENV'] === 'production') {
    delete normalized.stack;
  }

  return normalized;
}

function getTRPCStatusCode(code: string): number {
  const statusMap: Record<string, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TIMEOUT: 408,
    CONFLICT: 409,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    UNPROCESSABLE_CONTENT: 422,
    TOO_MANY_REQUESTS: 429,
    CLIENT_CLOSED_REQUEST: 499,
    INTERNAL_SERVER_ERROR: 500,
  };
  return statusMap[code] || 500;
}

function mapTRPCCodeToErrorType(code: string): ErrorType {
  const typeMap: Record<string, ErrorType> = {
    BAD_REQUEST: ErrorType.VALIDATION,
    UNAUTHORIZED: ErrorType.AUTHENTICATION,
    FORBIDDEN: ErrorType.AUTHORIZATION,
    NOT_FOUND: ErrorType.NOT_FOUND,
    CONFLICT: ErrorType.CONFLICT,
    TOO_MANY_REQUESTS: ErrorType.RATE_LIMIT,
    INTERNAL_SERVER_ERROR: ErrorType.INTERNAL,
  };
  return typeMap[code] || ErrorType.INTERNAL;
}

/**
 * Express error handler middleware
 */
export function expressErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const normalized = normalizeError(error);
  const correlationId = uuidv4();

  // Log spécifique pour la surveillance de sécurité
  if (normalized.type === ErrorType.CSRF) {
    logger.warn("[SECURITY_MONITOR] CSRF_FAILURE_DETECTED", {
      correlationId,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  // Log d'erreur structuré
  logger.error("[ErrorHandler] Request error", error, {
    correlationId,
    type: normalized.type,
    message: normalized.message,
    statusCode: normalized.statusCode,
    path: req.path,
    method: req.method,
    details: normalized.details,
  });

  // Capture Sentry pour les erreurs critiques
  if (normalized.statusCode >= 500) {
    setTag("correlationId", correlationId);
    setTag("path", req.path);
    setTag("method", req.method);
    setExtra("details", normalized.details);
    sentryCaptureException(error);
  }

  // Réponse JSON standardisée
  res.setHeader("Content-Type", "application/json");
  res.status(normalized.statusCode).json({
    error: {
      type: normalized.type,
      message: normalized.message,
      correlationId: correlationId,
    },
    ...(process.env['NODE_ENV'] !== 'production' && { 
      debug: {
        details: normalized.details,
        stack: normalized.stack 
      }
    }),
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = uuidv4();
  logger.warn("[ErrorHandler] Route not found", {
    correlationId,
    path: req.path,
    method: req.method,
  });

  res.setHeader("Content-Type", "application/json");
  res.status(404).json({
    error: {
      type: ErrorType.NOT_FOUND,
      message: `Route ${req.method} ${req.originalUrl} not found`,
      correlationId: correlationId,
    },
  });
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  process.on("uncaughtException", (error) => {
    logger.fatal("CRITICAL UNCAUGHT EXCEPTION", error);
    setTimeout(() => process.exit(1), 1000);
  });
  
  process.on("unhandledRejection", (reason) => {
    logger.error("UNHANDLED REJECTION", reason);
  });
  
  logger.info("[ErrorHandler] Global error handlers registered");
}
