/**
 * BLOC 6 : Service de Retry avec Exponential Backoff
 * Gère les retries automatiques avec timeout
 */

import { logger } from "../infrastructure/logger";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 30000,
  backoffMultiplier: 2,
};

export class RetryService {
  /**
   * Exécuter une fonction avec retry automatique
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName: string,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;
    let delay = opts.initialDelayMs;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        logger.info(`[Retry] Attempting ${operationName}`, { attempt, maxRetries: opts.maxRetries });

        // ✅ Exécuter avec timeout
        return await this.executeWithTimeout(fn, opts.timeoutMs);
      } catch (error: any) {
        lastError = error as Error;
        logger.warn(`[Retry] Attempt ${attempt} failed for ${operationName}`, {
          error: lastError.message,
          attempt,
          maxRetries: opts.maxRetries,
        });

        if (attempt < opts.maxRetries) {
          // Attendre avant de réessayer
          await this.sleep(delay);
          // Augmenter le délai exponentiellement
          delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
        }
      }
    }

    logger.error(`[Retry] All ${opts.maxRetries} attempts failed for ${operationName}`, {
      error: lastError?.message,
    });

    throw lastError || new Error(`Failed after ${opts.maxRetries} attempts`);
  }

  /**
   * Exécuter une fonction avec timeout
   */
  private static executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Attendre un délai
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve: any) => setTimeout(resolve, ms));
  }
}
