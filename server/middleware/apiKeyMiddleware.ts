import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { getDbInstance } from "../db";

/**
 * API KEY MIDDLEWARE (SÉCURISÉ)
 * ✅ FAIL-CLOSED : Si la vérification échoue ou si la table n'existe pas, l'accès est refusé.
 * ✅ FIX V8 : Typage strict sans contournement TypeScript
 */

const API_KEY_CACHE_TTL = 300; // 5 minutes

const publicApiKeysTable = pgTable("public_api_keys", {
  id: integer("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  key: varchar("key", { length: 128 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull(),
  createdAt: timestamp("created_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
});

function getApiKeyHeaderValue(headerValue: string | string[] | undefined): string | undefined {
  if (typeof headerValue === "string") {
    const trimmed = headerValue.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(headerValue)) {
    const firstValue = headerValue.find((value) => value.trim().length > 0);
    return firstValue?.trim();
  }

  return undefined;
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = getApiKeyHeaderValue(req.headers["x-api-key"]);

  if (!apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Header x-api-key requis.",
    });
    return;
  }

  try {
    const redis = getRedisClient();
    const cacheKey = `apikey:${apiKey}`;
    const cachedTenantId = await redis.get(cacheKey);

    if (cachedTenantId) {
      const parsedTenantId = parsePositiveInteger(cachedTenantId);
      if (parsedTenantId === null) {
        logger.error("[ApiKey] Cache corruption detected for API key tenant binding", {
          cacheKey,
          cachedTenantId,
        });
        await redis.del(cacheKey);
      } else {
        req.apiKeyTenantId = parsedTenantId;
        next();
        return;
      }
    }

    const db = getDbInstance();

    const result = await db
      .select({
        tenantId: publicApiKeysTable.tenantId,
        expiresAt: publicApiKeysTable.expiresAt,
      })
      .from(publicApiKeysTable)
      .where(and(eq(publicApiKeysTable.key, apiKey), eq(publicApiKeysTable.isActive, true)))
      .limit(1);

    const apiKeyRecord = result[0];
    if (!apiKeyRecord) {
      logger.warn("[ApiKey] Invalid or inactive API key", {
        keyPrefix: apiKey.substring(0, 8),
      });
      res.status(403).json({
        error: "Forbidden",
        message: "Clé API invalide ou désactivée.",
      });
      return;
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt.getTime() <= Date.now()) {
      logger.warn("[ApiKey] Expired API key rejected", {
        keyPrefix: apiKey.substring(0, 8),
        tenantId: apiKeyRecord.tenantId,
      });
      res.status(403).json({
        error: "Forbidden",
        message: "Clé API expirée.",
      });
      return;
    }

    if (!Number.isInteger(apiKeyRecord.tenantId) || apiKeyRecord.tenantId <= 0) {
      logger.error("[ApiKey] Invalid tenantId stored for API key", {
        keyPrefix: apiKey.substring(0, 8),
        tenantId: apiKeyRecord.tenantId,
      });
      res.status(500).json({
        error: "Security error",
        message: "Association tenant invalide pour cette clé API.",
      });
      return;
    }

    await redis.set(cacheKey, String(apiKeyRecord.tenantId), "EX", API_KEY_CACHE_TTL);
    req.apiKeyTenantId = apiKeyRecord.tenantId;
    next();
  } catch (error: unknown) {
    logger.error("[ApiKey] Middleware error (FAIL-CLOSED)", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: "Internal Security Error" });
  }
}

export async function optionalApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = getApiKeyHeaderValue(req.headers["x-api-key"]);
  if (!apiKey) {
    next();
    return;
  }

  await apiKeyMiddleware(req, res, next);
}
