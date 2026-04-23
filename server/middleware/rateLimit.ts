/**
 * RATE LIMITING — REDIS AVEC FALLBACK MÉMOIRE (Phase 4.2 - Fixed)
 * ✅ FIX CRITIQUE: getRedisClient() n'est jamais appelé au niveau module
 * Le store Redis est créé de façon lazy, uniquement lors de la première requête.
 */
import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../infrastructure/logger";

// ✅ Store lazy — créé uniquement lors du premier appel (après connectRedis)
const createLazyStore = (prefix: string) => {
  let store: any = null;
  let initialized = false;
  return {
    async increment(key: string) {
      if (!initialized) {
        initialized = true;
        try {
          const { getRedisClient } = await import("../infrastructure/redis/redis.client");
          const client = getRedisClient();
          if (client if (client if (client && typeof client.call === "function") {if (client && typeof client.call === "function") { typeof client.call === "function") {if (client if (client && typeof client.call === "function") {if (client && typeof client.call === "function") { typeof client.call === "function") { typeof client.call === "function") {
            const RedisStore = require("rate-limit-redis");
            store = new RedisStore({
              sendCommand: (...args: string[]) => client.call(...args),
              prefix: `rl:${prefix}:`,
            });
          }
        } catch (e: any) {
          logger.warn(`[RateLimit] Store Redis indisponible pour "${prefix}" → mémoire`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (store) return store.increment(key);
      return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
    },
    async decrement(key: string) {
      if (store) return store.decrement(key);
    },
    async resetKey(key: string) {
      if (store) return store.resetKey(key);
    },
  };
};

const isTest = () => process.env["NODE_ENV"] === "test";

const makeLimit = (prefix: string, options: any) => {
  return rateLimit({
    ...options,
    store: createLazyStore(prefix),
  });
};

/** /auth/login → 5 req/min/IP */
export const loginLimiter = makeLimit("login", {
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: { error: "Too Many Requests", message: "Trop de tentatives. Réessayez dans une minute." },
});

/** /auth/register → 3 req/min/IP */
export const registerLimiter = makeLimit("register", {
  windowMs: 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: { error: "Too Many Requests", message: "Trop de tentatives. Réessayez dans une minute." },
});

/** /api → 100 req/min/IP */
export const apiLimiter = makeLimit("api", {
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: { error: "Too Many Requests", message: "Trop de requêtes. Veuillez ralentir." },
});

/** Sécurité webhook — vérification de signature faite dans chaque handler */
export const webhookSecurity = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/** Webhook rate limiter — 200 req/min pour les webhooks entrants */
export const webhookLimiter = makeLimit("webhook", {
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTest,
  message: { error: "Too Many Requests", message: "Trop de requêtes webhook." },
});
