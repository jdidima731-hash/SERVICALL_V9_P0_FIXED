/**
 * OpenAI Key Management Service
 * Gère les clés OpenAI des clients SaaS avec validation et fallback
 * ✅ Optimisé pour la vente: Permet à chaque client d'utiliser sa propre clé OpenAI
 */

import { OpenAI } from "openai";
import { logger } from "../infrastructure/logger";
import { ENV } from "../_core/env";

export interface OpenAIKeyConfig {
  tenantId: number;
  apiKey: string;
  baseURL?: string;
  model?: string; // Modèle par défaut pour ce tenant
  isValid?: boolean;
  lastValidated?: Date;
  errorMessage?: string;
}

/**
 * Cache des clés validées pour éviter les appels répétés
 */
const keyCache = new Map<number, OpenAIKeyConfig>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Valider une clé OpenAI en testant un appel léger
 */
export async function validateOpenAIKey(apiKey: string, baseURL?: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: baseURL || ENV.openaiApiUrl || "https://api.openai.com/v1",
    });

    // Appel léger pour valider la clé
    await client.models.list();

    return { valid: true };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.warn("[OpenAI Key Management] Validation failed", {
      error: errorMessage,
      apiKey: apiKey.slice(0, 10) + "...",
    });

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Obtenir ou créer un client OpenAI pour un tenant
 */
export async function getOpenAIClientForTenant(
  tenantId: number,
  customApiKey?: string
): Promise<{ client: OpenAI; error?: string }> {
  try {
    // Utiliser la clé personnalisée du tenant si fournie
    const apiKey = customApiKey || ENV.openaiApiKey;
    const baseURL = ENV.openaiApiUrl || "https://api.openai.com/v1";

    if (!apiKey) {
      return {
        
        client: null as unknown,
        error: "No OpenAI API key configured for this tenant",
      };
    }

    // Vérifier le cache
    const cached = keyCache.get(tenantId);
    if (cached && cached.apiKey === apiKey && cached.isValid) {
      const now = new Date();
      if (cached.lastValidated && now.getTime() - cached.lastValidated.getTime() < CACHE_TTL) {
        logger.debug("[OpenAI Key Management] Using cached key", { tenantId });
        return {
          client: new OpenAI({
            apiKey,
            baseURL,
          }),
        };
      }
    }

    // Valider la clé
    const validation = await validateOpenAIKey(apiKey, baseURL);

    if (!validation.valid) {
      logger.error("[OpenAI Key Management] Invalid key for tenant", {
        tenantId,
        error: validation.error,
      });

      // Mettre en cache l'erreur
      keyCache.set(tenantId, {
        tenantId,
        apiKey,
        isValid: false,
        lastValidated: new Date(),
        errorMessage: validation.error,
      });

      return {
        
        client: null as unknown,
        error: validation.error,
      };
    }

    // Mettre en cache la clé valide
    keyCache.set(tenantId, {
      tenantId,
      apiKey,
      baseURL,
      isValid: true,
      lastValidated: new Date(),
    });

    logger.info("[OpenAI Key Management] Key validated for tenant", { tenantId });

    return {
      client: new OpenAI({
        apiKey,
        baseURL,
      }),
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[OpenAI Key Management] Error getting client", {
      tenantId,
      error: errorMessage,
    });

    return {
      
      client: null as unknown,
      error: errorMessage,
    };
  }
}

/**
 * Invalider le cache pour un tenant (après mise à jour de la clé)
 */
export function invalidateCacheForTenant(tenantId: number): void {
  keyCache.delete(tenantId);
  logger.info("[OpenAI Key Management] Cache invalidated", { tenantId });
}

/**
 * Obtenir le statut de la clé pour un tenant
 */
export function getKeyStatus(tenantId: number): OpenAIKeyConfig | null {
  return keyCache.get(tenantId) || null;
}

/**
 * Nettoyer le cache des entrées expirées
 */
export function cleanupExpiredCache(): void {
  const now = new Date();
  let cleaned = 0;

  for (const [tenantId, config] of keyCache.entries()) {
    if (config.lastValidated && now.getTime() - config.lastValidated.getTime() > CACHE_TTL) {
      keyCache.delete(tenantId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info("[OpenAI Key Management] Cache cleanup", { cleaned });
  }
}

/**
 * Initialiser le nettoyage du cache (à appeler au démarrage du serveur)
 * ✅ FIX H2 — stocker le handle et retourner une fonction stop()
 */
let _cacheCleanupHandle: ReturnType<typeof setInterval> | null = null;

export function initializeCacheCleanup(): () => void {
  if (_cacheCleanupHandle) {
    logger.warn("[OpenAI Key Management] Cache cleanup already initialized");
    return () => { /* already running */ };
  }
  // Nettoyer le cache toutes les heures
  _cacheCleanupHandle = setInterval(() => {
    cleanupExpiredCache();
  }, 60 * 60 * 1000);

  logger.info("[OpenAI Key Management] Cache cleanup initialized");

  return () => {
    if (_cacheCleanupHandle) {
      clearInterval(_cacheCleanupHandle);
      _cacheCleanupHandle = null;
      logger.info("[OpenAI Key Management] Cache cleanup stopped");
    }
  };
}