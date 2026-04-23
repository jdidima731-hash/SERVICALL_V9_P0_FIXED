/**
 * REQUEST VALIDATION MIDDLEWARE
 * Validation Zod des corps de requête, query params et URL params
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { AppError, ErrorType } from "../config/appErrors";
import { logger } from "../infrastructure/logger";

/** Extrait message + errors depuis une erreur inconnue (ZodError ou Error) */
function extractErrorDetail(error: any): string | string[] {
  if (error !== null && typeof error === "object") {
    const e = error as Record<string, unknown>;
    // ZodError expose un tableau .errors
    if (Array.isArray(e["errors"])) {
      return (e["errors"] as Array<{ message?: string }>)
        .map((issue) => issue.message ?? "Validation error");
    }
    if (typeof e["message"] === "string") return e["message"];
  }
  return String(error);
}

/**
 * Crée un middleware de validation pour le corps de la requête
 */
export function validateBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      logger.warn("[Validation] Body validation failed", {
        path: req.path,
        method: req.method,
        error: extractErrorDetail(error),
      });
      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid request body",
        400,
        extractErrorDetail(error)
      );
    }
  };
}

/**
 * Crée un middleware de validation pour les query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as typeof req.query;
      next();
    } catch (error: any) {
      logger.warn("[Validation] Query validation failed", {
        path: req.path,
        method: req.method,
        error: extractErrorDetail(error),
      });
      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid query parameters",
        400,
        extractErrorDetail(error)
      );
    }
  };
}

/**
 * Crée un middleware de validation pour les URL params
 */
export function validateParams(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.params);
      req.params = validated as typeof req.params;
      next();
    } catch (error: any) {
      logger.warn("[Validation] Params validation failed", {
        path: req.path,
        method: req.method,
        error: extractErrorDetail(error),
      });
      throw new AppError(
        ErrorType.VALIDATION,
        "Invalid URL parameters",
        400,
        extractErrorDetail(error)
      );
    }
  };
}
