/**
 * Error Handling Service - Servicall CRM v2
 * Gestion centralisée, traçabilité et résilience.
 */

import { AppError, errorMapper } from "../_core/errors";
import { logger, logContext } from "../infrastructure/logger";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any= null;
  let delay = opts.initialDelayMs!;

  for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // On n'essaie de retry que si l'erreur est marquée comme retryable
      const isRetryable = error instanceof AppError ? error.isRetryable : true;
      
      if (attempt < opts.maxRetries! && isRetryable) {
        logger.warn(`[Retry] Attempt ${attempt + 1}/${opts.maxRetries} failed. Retrying in ${delay}ms...`, {
          error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
        });
        await new Promise<void>((resolve: any) => setTimeout(resolve, delay));
        delay = Math.min(delay * opts.backoffMultiplier!, opts.maxDelayMs!);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Log and Format Error for Response
 */
export function handleAppError(
  error: any,
  context: logContext = {}
): AppError {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error?.name === "ZodError") {
    appError = errorMapper.validation((error as Record<string, unknown>)["errors"]);
  } else if (error?.message?.includes("ECONNREFUSED") || error?.message?.includes("Redis")) {
    appError = errorMapper.redis();
  } else {
    appError = errorMapper.internal(error);
  }

  // Logging structuré
  logger.error(`[${appError.code}] ${appError.message}`, error, {
    ...context,
    errorCode: appError.code,
    statusCode: appError.statusCode,
    isRetryable: appError.isRetryable
  });

  return appError;
}

/**
 * Alias pour logError pour compatibilité ascendante si nécessaire
 */
export const logError = (error: any, context: any) => {
  handleAppError(error, context);
};
