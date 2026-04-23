/**
 * ARCHITECTURE REDIS CENTRALISÉE — PRODUCTION-READY
 * ─────────────────────────────────────────────────────────
 * ✅ CORRECTION CRITIQUE:
 * - Redis est OBLIGATOIRE en production (pas de fallback mock)
 * - Fail-fast au boot si Redis indisponible
 * - RedisMock uniquement en développement
 */
import Redis from "ioredis";
import RedisMockLib from "ioredis-mock";
const RedisMock = RedisMockLib ;
import { logger } from "../../infrastructure/logger";

export let redisClient: Redis | null = null;

/**
 * Initialise la connexion Redis.
 * ✅ En production: Redis est OBLIGATOIRE, sinon le serveur s'arrête
 * ✅ En développement: RedisMock par défaut
 */
export async function connectRedis(): Promise<Redis> {
  if (redisClient) return redisClient;

  const redisUrl = process.env["REDIS_URL"];
  const isProduction = process.env["NODE_ENV"] === "production";
  const redisDisabled = process.env["DISABLE_REDIS"] === "true";

  if (redisDisabled) {
    logger.warn("[Redis] ⚠️ Redis désactivé par configuration — utilisation d'un store en mémoire");
    redisClient = new RedisMock() ;
    return redisClient;
  }

  if (isProduction) {
    // ✅ CORRECTION CRITIQUE: Redis reste obligatoire en production si non désactivé explicitement
    if (!redisUrl) {
      logger.error("[Redis] ❌ REDIS_URL est requis en production si DISABLE_REDIS n'est pas activé.");
      process.exit(1);
    }

    logger.info("[Redis] Connexion au serveur Redis réel (production)...");
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          if (times > 10) {
            logger.error("[Redis] ❌ Impossible de se connecter après 10 tentatives. Arrêt du serveur.");
            process.exit(1);
          }
          return delay;
        },
        connectTimeout: 10000,
        commandTimeout: 5000,
      });
      
      redisClient.on("error", (err) => {
        logger.error("[Redis] Erreur de connexion", { error: err.message });
      });

      redisClient.on("connect", () => {
        logger.info("[Redis] ✅ Connecté au serveur Redis");
      });

      // ✅ Vérifier la connexion immédiatement
      await redisClient.ping();
      logger.info("[Redis] ✅ Ping réussi - Redis est opérationnel");
    } catch (e: any) {
      logger.error("[Redis] ❌ Impossible de se connecter à Redis en production", { error: e.message });
      process.exit(1);
    }
  } else {
    // Mode développement : utiliser RedisMock
    logger.info("[Redis] Mode Développement : Utilisation de RedisMock (en mémoire)");
    redisClient = new RedisMock() ;
  }

  return redisClient;
}

/**
 * Retourne l'instance Redis courante.
 * ✅ En production: lance une erreur fatale si Redis n'est pas initialisé
 * ✅ En développement: fallback sur RedisMock
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const isProduction = process.env["NODE_ENV"] === "production";
    const redisDisabled = process.env["DISABLE_REDIS"] === "true";

    if (isProduction && !redisDisabled) {
      logger.error("[Redis] ❌ getRedisClient() appelé avant connectRedis() en production. Arrêt du serveur.");
      process.exit(1);
    }

    logger.warn("[Redis] getRedisClient() sans Redis actif — fallback store mémoire");
    redisClient = new RedisMock() ;
  }
  return redisClient;
}

export function resetRedisClient(): void {
  redisClient = null;
}

/**
 * Export proxy pour compatibilité.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const value = (client )[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
