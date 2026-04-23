/**
 * bullmq.connection.ts — Factory de connexions Redis dédiées pour BullMQ
 *
 * POURQUOI UNE FACTORY SÉPARÉE :
 * BullMQ exige maxRetriesPerRequest = null sur ses connexions.
 * Le client Redis partagé (redis.client.ts) utilise maxRetriesPerRequest = 3,
 * ce qui provoque des erreurs non déterministes quand BullMQ réutilise ce client.
 *
 * RÈGLE : Toute Queue ou Worker BullMQ DOIT utiliser makeBullMQConnection()
 *         et JAMAIS getRedisClient() directement.
 */

import { ENV } from "../../_core/env";
import { logger } from "../logger";

export interface BullMQConnectionOptions {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: false;
  lazyConnect?: boolean;
}

/**
 * Retourne des ConnectionOptions compatibles BullMQ.
 * Crée toujours un nouvel objet de config (BullMQ gère sa propre instance ioredis).
 * En dev sans Redis configuré, retourne null — les queues sont désactivées.
 */
export function makeBullMQConnection(): BullMQConnectionOptions | null {
  const redisUrl = ENV.redisUrl || process.env["REDIS_URL"];
  const redisDisabled = process.env["DISABLE_REDIS"] === "true";

  if (redisDisabled || !redisUrl) {
    if (process.env["NODE_ENV"] === "production" && !redisDisabled) {
      logger.error("[BullMQ] ❌ REDIS_URL requis pour BullMQ en production");
      process.exit(1);
    }
    logger.warn("[BullMQ] Redis non configuré — queues BullMQ désactivées");
    return null;
  }

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379", 10),
      password: url.password || undefined,
      // Ces deux options sont OBLIGATOIRES pour BullMQ :
      maxRetriesPerRequest: null,   // BullMQ gère sa propre logique de retry
      enableReadyCheck: false,      // évite des race conditions au démarrage
    };
  } catch (err: any) {
    logger.error(`[BullMQ] ❌ REDIS_URL invalide: ${err.message}`);
    process.exit(1);
  }
}
