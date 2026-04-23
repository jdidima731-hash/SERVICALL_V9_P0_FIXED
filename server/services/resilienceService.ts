/**
 * Resilience Service — Gestion des retries, circuit breaker, timeouts et observabilité
 * ✅ CORRECTION CRITIQUE: CircuitBreaker renforcé pour OpenAI, Twilio et Stripe
 * Assure la stabilité du système face aux pannes transitoires et protège l'état central.
 */

import { logger } from "../infrastructure/logger";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// ✅ Logging centralisé des timeouts et erreurs IA
// ============================================================
function logToFile(entry: Record<string, unknown>): void {
  try {
    const logsDir = path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "ai-errors.log"),
      JSON.stringify(entry) + "\n",
      "utf8"
    );
  } catch (_) {
    // Logging must never crash the application
  }
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitorIntervalMs?: number;
}

export interface ResilienceOptions {
  name: string;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
  timeoutMs?: number;
  idempotencyKey?: string;
  validateResponse?: (data: any) => boolean;
  module?: "API" | "IA" | "TWILIO" | "SYSTEM" | "DB" | "AUTH" | "WORKFLOW";
}

// ============================================================
// ✅ CircuitBreaker autonome — utilisable directement pour
//    OpenAI, Twilio, Stripe selon le prompt
// ============================================================

/**
 * CircuitBreaker — Protège un service externe contre les surcharges.
 *
 * Usage:
 *   const openAIBreaker = new CircuitBreaker({ maxFailures: 5 });
 *   const result = await openAIBreaker.execute(() => openai.chat.completions.create(...));
 */
export class CircuitBreaker {
  failures: number = 0;
  maxFailures: number;
  private state: CircuitState = CircuitState.CLOSED;
  private lastFailureTime?: number;
  private resetTimeoutMs: number;
  private name: string;

  constructor(options?: { maxFailures?: number; resetTimeoutMs?: number; name?: string }) {
    this.maxFailures = options?.maxFailures ?? 5;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 30000;
    this.name = options?.name ?? "CircuitBreaker";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN && this.lastFailureTime) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(`[CircuitBreaker] ${this.name} moving to HALF_OPEN`);
      } else {
        const err = new Error(`Circuit breaker triggered for ${this.name}`);
        logger.error("AI_TIMEOUT", {
          service: this.name,
          timestamp: Date.now(),
          reason: "circuit_open",
        });
        logToFile({
          level: "AI_TIMEOUT",
          service: this.name,
          timestamp: Date.now(),
          reason: "circuit_open",
        });
        throw err;
      }
    }

    try {
      const result = await fn();
      // Success: reset failures
      this.failures = 0;
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        logger.info(`[CircuitBreaker] ${this.name} recovered — state CLOSED`);
      }
      return result;
    } catch (err: any) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.maxFailures) {
        this.state = CircuitState.OPEN;
        const msg = `Circuit breaker triggered for ${this.name} after ${this.failures} failures`;
        logger.error(`[CircuitBreaker] ${msg}`, err);
        logger.error("AI_TIMEOUT", {
          service: this.name,
          timestamp: Date.now(),
          reason: "threshold_reached",
          failures: this.failures,
        });
        logToFile({
          level: "AI_TIMEOUT",
          service: this.name,
          timestamp: Date.now(),
          reason: "threshold_reached",
          failures: this.failures,
        });
      }
      throw err;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = undefined;
  }
}

// ============================================================
// ✅ Instances pré-configurées pour OpenAI, Twilio et Stripe
// ============================================================

/** Circuit breaker pour les appels OpenAI (IA) */
export const openAIBreaker = new CircuitBreaker({
  name: "openai",
  maxFailures: 5,
  resetTimeoutMs: 30000,
});

/** Circuit breaker pour les appels Twilio (téléphonie) */
export const twilioBreaker = new CircuitBreaker({
  name: "twilio",
  maxFailures: 5,
  resetTimeoutMs: 30000,
});

/** Circuit breaker pour les appels Stripe (paiement) */
export const stripeBreaker = new CircuitBreaker({
  name: "stripe",
  maxFailures: 5,
  resetTimeoutMs: 60000,
});

// ============================================================
// ResilienceService — Orchestrateur complet (retry + CB + timeout)
// ============================================================

export class ResilienceService {
  private static circuits = new Map<string, {
    state: CircuitState;
    failures: number;
    lastFailureTime?: number;
    options: CircuitBreakerOptions;
  }>();

  /**
   * Exécute une opération avec une suite complète de mécanismes de résilience.
   * C'est la méthode recommandée pour tous les appels externes.
   */
  static async execute<T>(
    operation: () => Promise<T>,
    options: ResilienceOptions
  ): Promise<T> {
    const {
      name,
      retry = { maxRetries: 3, delayMs: 500, backoffFactor: 2 },
      circuitBreaker = { failureThreshold: 5, resetTimeoutMs: 30000 },
      timeoutMs = 15000,
      idempotencyKey,
      validateResponse,
      module = "SYSTEM"
    } = options;

    const startTime = Date.now();
    let attempt = 0;

    // 1. Circuit Breaker Check
    const circuit = this.getCircuit(name, circuitBreaker);
    if (circuit.state === CircuitState.OPEN && circuit.lastFailureTime) {
      if (Date.now() - (circuit.lastFailureTime as number) > circuit.options.resetTimeoutMs) {
        circuit.state = CircuitState.HALF_OPEN;
        logger.info(`[Resilience] Circuit ${name} moving to HALF_OPEN`, { module });
      } else {
        logger.warn(`[Resilience] Circuit ${name} is OPEN, call rejected`, { module });
        logToFile({
          level: "AI_TIMEOUT",
          service: name,
          timestamp: Date.now(),
          reason: "circuit_open",
          module,
        });
        throw new Error(`Circuit Breaker ${name} is OPEN`);
      }
    }

    // 2. Execution with Retry & Timeout
    const executeWithRetry = async (): Promise<T> => {
      let lastError: any;
      let currentDelay = retry.delayMs;

      for (attempt = 1; attempt <= retry.maxRetries; attempt++) {
        try {
          // Wrap with timeout via Promise.race
          const result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
                timeoutMs
              )
            )
          ]);

          // 3. Response Validation
          if (validateResponse && !validateResponse(result)) {
            throw new Error(`Invalid response format from ${name}`);
          }

          // Success — Record metrics and return
          const duration = Date.now() - startTime;
          this.recordSuccess(name, duration, attempt, module);
          return result;

        } catch (error: any) {
          lastError = error;

          const isTimeout =
            error?.message === "LLM timeout" ||
            (error?.message && String(error).toLowerCase().includes("timeout"));

          if (isTimeout) {
            logger.error("AI_TIMEOUT", {
              service: name,
              timestamp: Date.now(),
              module,
            });
            logToFile({
              level: "AI_TIMEOUT",
              service: name,
              timestamp: Date.now(),
              module,
              attempt,
            });
          }

          const isRetryable = this.isRetryableError(error);
          if (attempt < retry.maxRetries && isRetryable) {
            if (retry.onRetry) retry.onRetry(attempt, error);

            logger.warn(
              `[Resilience] Attempt ${attempt} failed for ${name}, retrying in ${currentDelay}ms...`,
              {
                module,
                error: (error instanceof Error ? error.message : String(error)),
                idempotencyKey,
              }
            );

            await new Promise(resolve => setTimeout(resolve, currentDelay));
            currentDelay *= retry.backoffFactor ?? 1;
          } else {
            break;
          }
        }
      }

      // Final Failure
      const totalDuration = Date.now() - startTime;
      this.recordFailure(name, totalDuration, attempt, lastError, module);
      throw lastError;
    };

    return executeWithRetry();
  }

  private static getCircuit(name: string, options: CircuitBreakerOptions) {
    let circuit = this.circuits.get(name);
    if (!circuit) {
      circuit = { state: CircuitState.CLOSED, failures: 0, options };
      this.circuits.set(name, circuit);
    }
    return circuit;
  }

  private static recordSuccess(
    name: string,
    duration: number,
    attempts: number,
    module: string
  ) {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = CircuitState.CLOSED;
    }

    logger.info(`[Resilience][SUCCESS] ${name}`, {
      module: module as "IA" | "SYSTEM" | "API" | "TWILIO" | "DB" | "AUTH" | "WORKFLOW",
      duration_ms: duration,
      attempts,
      status: 200,
    });
  }

  private static recordFailure(
    name: string,
    duration: number,
    attempts: number,
    error: any,
    module: string
  ) {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.failures++;
      circuit.lastFailureTime = Date.now();

      if (circuit.failures >= circuit.options.failureThreshold) {
        circuit.state = CircuitState.OPEN;
        logger.error(
          `[Resilience] Circuit ${name} is now OPEN due to ${circuit.failures} failures`,
          error,
          {
            module: module as "IA" | "SYSTEM" | "API" | "TWILIO" | "DB" | "AUTH" | "WORKFLOW",
          }
        );
        logToFile({
          level: "AI_TIMEOUT",
          service: name,
          timestamp: Date.now(),
          reason: "circuit_opened",
          failures: circuit.failures,
          module,
        });
      }
    }

    logger.error(
      `[Resilience][FAILURE] ${name} failed after ${attempts} attempts`,
      error,
      {
        module: module as "IA" | "SYSTEM" | "API" | "TWILIO" | "DB" | "AUTH" | "WORKFLOW",
        duration_ms: duration,
        attempts,
        status: (error as Record<string, unknown>)["status"] ?? 500,
      }
    );
  }

  private static isRetryableError(error: any): boolean {
    if ((error as Record<string, unknown>)["status"]) {
      return [408, 429, 500, 502, 503, 504].includes(Number((error as Record<string, unknown>)["status"]));
    }

    const retryableCodes = [
      "ECONNRESET",
      "ETIMEDOUT",
      "EADDRINUSE",
      "ECONNREFUSED",
      "EPIPE",
    ];
    if ((error as Record<string, unknown>)["code"] && retryableCodes.includes(String((error as Record<string, unknown>)["code"]))) {
      return true;
    }

    if (
      (error instanceof Error ? error.message : String(error)) &&
      ((error instanceof Error ? error.message : String(error)).includes("Timeout") || (error instanceof Error ? error.message : String(error)).includes("timeout"))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Méthodes legacy conservées pour la compatibilité
   */
  static async withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
    return this.execute(fn, { name: "legacy-retry", retry: options });
  }

  static async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(fn, { name: "legacy-timeout", timeoutMs });
    } catch (e: any) {
      return fallback();
    }
  }

  static async withRollback<T>(
    task: () => Promise<T>,
    rollback: () => Promise<void>
  ): Promise<T> {
    try {
      return await task();
    } catch (error: any) {
      logger.error("[Resilience] Task failed, initiating rollback...", {
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error),
      });
      try {
        await rollback();
      } catch (rollbackError) {
        logger.error("[Resilience] Rollback FAILED!", rollbackError);
      }
      throw error;
    }
  }
}
