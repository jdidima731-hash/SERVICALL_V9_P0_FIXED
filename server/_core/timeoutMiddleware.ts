/**
 * BLOC 2 - Middleware de timeout pour tRPC
 * Empêche les requêtes de bloquer indéfiniment
 */

import { TRPCError } from "@trpc/server";
import { middleware } from "./trpc";

export interface TimeoutOptions {
  timeoutMs?: number;
  errorMessage?: string;
}

/**
 * Crée un middleware de timeout pour les procédures tRPC
 * @param options Configuration du timeout
 * @returns Middleware tRPC
 */
export function createTimeoutMiddleware(options: TimeoutOptions = {}) {
  const { 
    timeoutMs = 30000, // 30 secondes par défaut
    errorMessage = "La requête a expiré. Veuillez réessayer."
  } = options;

  return middleware(async ({ next, path }) => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new TRPCError({
            code: "TIMEOUT",
            message: `${errorMessage} (${path})`,
          })
        );
      }, timeoutMs);
    });

    try {
      // Course entre la requête et le timeout
      const result = await Promise.race([
        next(),
        timeoutPromise,
      ]);
      return result;
    } catch (error: any) {
      // Si c'est une erreur de timeout, on la propage
      if (error instanceof TRPCError && error.code === "TIMEOUT") {
        throw error;
      }
      // Sinon, on encapsule l'erreur originale
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
        cause: error,
      });
    }
  });
}

/**
 * Timeouts prédéfinis pour différents types d'opérations
 */
export const TIMEOUTS = {
  /** Requêtes rapides (lecture simple) - 5 secondes */
  FAST: 5000,
  
  /** Requêtes standard (lecture avec jointures) - 15 secondes */
  STANDARD: 15000,
  
  /** Requêtes lentes (agrégations, calculs) - 30 secondes */
  SLOW: 30000,
  
  /** Opérations critiques (mutations importantes) - 60 secondes */
  CRITICAL: 60000,
  
  /** Opérations externes (API Twilio, OpenAI) - 90 secondes */
  EXTERNAL: 90000,
};

/**
 * Middleware de timeout rapide (5s)
 */
export const fastTimeout = createTimeoutMiddleware({ 
  timeoutMs: TIMEOUTS.FAST,
  errorMessage: "Requête trop lente (timeout 5s)"
});

/**
 * Middleware de timeout standard (15s)
 */
export const standardTimeout = createTimeoutMiddleware({ 
  timeoutMs: TIMEOUTS.STANDARD,
  errorMessage: "Requête trop lente (timeout 15s)"
});

/**
 * Middleware de timeout lent (30s)
 */
export const slowTimeout = createTimeoutMiddleware({ 
  timeoutMs: TIMEOUTS.SLOW,
  errorMessage: "Requête trop lente (timeout 30s)"
});

/**
 * Middleware de timeout critique (60s)
 */
export const criticalTimeout = createTimeoutMiddleware({ 
  timeoutMs: TIMEOUTS.CRITICAL,
  errorMessage: "Opération trop longue (timeout 60s)"
});

/**
 * Middleware de timeout pour appels externes (90s)
 */
export const externalTimeout = createTimeoutMiddleware({ 
  timeoutMs: TIMEOUTS.EXTERNAL,
  errorMessage: "Service externe non disponible (timeout 90s)"
});
