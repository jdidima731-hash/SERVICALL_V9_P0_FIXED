/**
 * IDEMPOTENCY SERVICE — PRODUCTION-READY
 * ✅ CORRECTION CRITIQUE:
 * - Fail-closed sur opérations critiques (webhooks, paiements)
 * - Pas de doublon silencieux en cas de panne
 * - Redis + DB pour garantir l'idempotence
 */

import { getRedisClient } from "../../infrastructure/redis/redis.client";
import { Logger } from "./Logger";
import { getDbInstance } from "../../db";
import { processedEvents } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";

export class IdempotencyService {
  private static logger = new Logger('IdempotencyService');
  private static TTL = 86400; // 24 hours

  /**
   * Checks if a key exists and sets it if not.
   * Returns true if the operation is allowed (first time), false otherwise.
   * Uses Redis for fast check and DB for persistence.
   * 
   * ✅ CORRECTION CRITIQUE: Fail-closed sur opérations critiques
   * - Si Redis/DB indisponible sur une opération critique: lever une erreur
   * - Jamais permettre un doublon par défaut
   */
  static async checkAndSet(key: string, context: string, isCritical: boolean = true): Promise<boolean> {
    try {
      // 1. Check Redis first (Fast path)
      const fullKey = `idempotency:${context}:${key}`;
      const client = getRedisClient();
      const redisResult = await client.set(fullKey, 'processed', 'EX', this.TTL, 'NX');

      if (!redisResult) {
        this.logger.warn('Duplicate operation detected (Redis)', { key, context });
        return false;
      }

      // 2. Check DB (Persistence path)
      const db = getDbInstance();
      const [existing] = await db.select()
        .from(processedEvents)
        .where(and(
          eq(processedEvents.source, context),
          eq(processedEvents.eventId, key)
        ))
        .limit(1);

      if (existing) {
        this.logger.warn('Duplicate operation detected (DB)', { key, context });
        return false;
      }

      // 3. Store in DB
      await db.insert(processedEvents).values({
        source: context,
        eventId: key,
        processedAt: new Date()
      });

      return true;
    } catch (error: unknown) {
      // ✅ CORRECTION CRITIQUE: Fail-closed sur opérations critiques
      this.logger.error('Idempotency check failed', { error, key, context, isCritical });
      
      if (isCritical) {
        // Sur opérations critiques (webhooks, paiements): rejeter plutôt que permettre un doublon
        throw new Error(`Idempotency check failed for critical operation: ${context}/${key}. Error: ${error.message}`);
      } else {
        // Sur opérations non-critiques: logger et permettre (mais c'est rare)
        this.logger.warn('Idempotency check failed on non-critical operation, allowing to proceed', { key });
        return true;
      }
    }
  }

  /**
   * Generates an idempotency key from a payload
   */
  static generateKey(payload: Record<string, unknown>): string {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
