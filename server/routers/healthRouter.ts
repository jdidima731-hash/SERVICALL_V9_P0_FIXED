/**
 * Health Router — PHASE 7
 * Format compatible avec le projet référence :
 * GET /api/trpc/health.check → { status: "ok", timestamp, services: { db, redis } }
 */
import { router } from "../_core/trpc";
import { publicProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    const checks: Record<string, string> = {};

    // ── DB check ────────────────────────────────────────────────────────────
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      checks.db = "ok";
    } catch (e: any) {
      logger.warn("[Health] DB check failed", { error: e });
      checks.db = "error";
    }

    // ── Redis check (optionnel) ─────────────────────────────────────────────
    try {
      const { getRedisClient } = await import("../infrastructure/redis/redis.client");
      const client = getRedisClient();
      await client.ping();
      checks.redis = "ok";
    } catch (_e) {
      checks.redis = "degraded";
    }

    const allOk = checks.db === "ok";
    return {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: checks,
    };
  }),
});
