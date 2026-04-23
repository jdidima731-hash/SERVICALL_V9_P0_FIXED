/**
 * OPENAI USAGE MONITOR
 * ✅ PHASE 6 — Tâche 17 : Monitoring usage OpenAI par tenant
 *
 * Enregistre dans Redis :
 *   - Nombre de tokens utilisés par tenant (input + output)
 *   - Coût estimé par tenant
 *   - Nombre d'appels par modèle
 *
 * Structure Redis :
 *   usage:tenant:{tenantId}:tokens:input   → compteur journalier
 *   usage:tenant:{tenantId}:tokens:output  → compteur journalier
 *   usage:tenant:{tenantId}:calls          → compteur journalier
 *   usage:tenant:{tenantId}:cost           → coût estimé en centimes
 *
 * TTL : 90 jours pour l'historique
 */
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { logger } from "../infrastructure/logger";

// Coûts OpenAI en USD par 1M tokens (approximatifs, à mettre à jour)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-realtime-preview": { input: 5.00, output: 20.00 }, // Coût estimé pour Realtime
  "gpt-4": { input: 30.00, output: 60.00 },
  "gpt-4-turbo": { input: 10.00, output: 30.00 },
  "gpt-3.5-turbo": { input: 0.50, output: 1.50 },
};

const TTL_DAILY = 90 * 24 * 3600; // 90 jours

function getDailyKey(tenantId: number, metric: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `usage:tenant:${tenantId}:${date}:${metric}`;
}

function getMonthlyKey(tenantId: number, metric: string): string {
  const date = new Date().toISOString().substring(0, 7); // YYYY-MM
  return `usage:tenant:${tenantId}:${date}:${metric}`;
}

/**
 * Enregistre l'utilisation d'un appel OpenAI pour un tenant.
 * Appelé après chaque invokeLLM() réussi.
 */
export async function recordOpenAIUsage(params: {
  tenantId: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  cached?: boolean;
}): Promise<void> {
  const { tenantId, model, inputTokens, outputTokens, latencyMs, cached } = params;

  try {
    const redis = getRedisClient();
    const pipeline = (redis as unknown).pipeline();

    // Compteurs journaliers
    const dailyInputKey = getDailyKey(tenantId, "tokens:input");
    const dailyOutputKey = getDailyKey(tenantId, "tokens:output");
    const dailyCallsKey = getDailyKey(tenantId, "calls");
    const dailyCachedKey = getDailyKey(tenantId, "calls:cached");

    pipeline.incrby(dailyInputKey, inputTokens);
    pipeline.expire(dailyInputKey, TTL_DAILY);
    pipeline.incrby(dailyOutputKey, outputTokens);
    pipeline.expire(dailyOutputKey, TTL_DAILY);
    pipeline.incr(dailyCallsKey);
    pipeline.expire(dailyCallsKey, TTL_DAILY);

    if (cached) {
      pipeline.incr(dailyCachedKey);
      pipeline.expire(dailyCachedKey, TTL_DAILY);
    }

    // Compteurs mensuels
    const monthlyInputKey = getMonthlyKey(tenantId, "tokens:input");
    const monthlyOutputKey = getMonthlyKey(tenantId, "tokens:output");
    const monthlyCallsKey = getMonthlyKey(tenantId, "calls");

    pipeline.incrby(monthlyInputKey, inputTokens);
    pipeline.expire(monthlyInputKey, TTL_DAILY);
    pipeline.incrby(monthlyOutputKey, outputTokens);
    pipeline.expire(monthlyOutputKey, TTL_DAILY);
    pipeline.incr(monthlyCallsKey);
    pipeline.expire(monthlyCallsKey, TTL_DAILY);

    // Coût estimé (en micro-USD pour éviter les flottants)
    const costs = MODEL_COSTS[model] ?? MODEL_COSTS["gpt-4o-mini"] ?? { input: 0, output: 0 };
    const costMicroUSD = Math.round(
      (inputTokens * costs.input + outputTokens * costs.output) / 1000 // per 1K tokens
    );

    const dailyCostKey = getDailyKey(tenantId, "cost_micro_usd");
    pipeline.incrby(dailyCostKey, costMicroUSD);
    pipeline.expire(dailyCostKey, TTL_DAILY);

    // Compteur par modèle
    const modelKey = getDailyKey(tenantId, `model:${model}`);
    pipeline.incr(modelKey);
    pipeline.expire(modelKey, TTL_DAILY);

    await pipeline.exec();

    logger.debug("[UsageMonitor] Usage recorded", {
      tenantId,
      model,
      inputTokens,
      outputTokens,
      costMicroUSD,
      latencyMs,
      cached,
    });
  } catch (err: any) {
    // Ne jamais faire échouer un appel LLM à cause du monitoring
    logger.warn("[UsageMonitor] Failed to record usage", { error: err, tenantId });
  }
}

/**
 * Récupère les statistiques d'utilisation journalières pour un tenant.
 */
export async function getDailyUsage(tenantId: number, date?: string): Promise<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
  cachedCalls: number;
  estimatedCostUSD: number;
}> {
  try {
    const redis = getRedisClient();
    const d = date || new Date().toISOString().split("T")[0];

    const [inputTokens, outputTokens, calls, cachedCalls, costMicroUSD] = await Promise.all([
      redis.get(`usage:tenant:${tenantId}:${d}:tokens:input`),
      redis.get(`usage:tenant:${tenantId}:${d}:tokens:output`),
      redis.get(`usage:tenant:${tenantId}:${d}:calls`),
      redis.get(`usage:tenant:${tenantId}:${d}:calls:cached`),
      redis.get(`usage:tenant:${tenantId}:${d}:cost_micro_usd`),
    ]);

    const input = parseInt(inputTokens ?? "0", 10);
    const output = parseInt(outputTokens ?? "0", 10);

    return {
      inputTokens: input,
      outputTokens: output,
      totalTokens: input + output,
      calls: parseInt(calls ?? "0", 10),
      cachedCalls: parseInt(cachedCalls ?? "0", 10),
      estimatedCostUSD: parseInt(costMicroUSD ?? "0", 10) / 1_000_000,
    };
  } catch (err: any) {
    logger.error("[UsageMonitor] Failed to get daily usage", err, { tenantId });
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, calls: 0, cachedCalls: 0, estimatedCostUSD: 0 };
  }
}

/**
 * Récupère les statistiques d'utilisation mensuelles pour un tenant.
 */
export async function getMonthlyUsage(tenantId: number, month?: string): Promise<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
  estimatedCostUSD: number;
}> {
  try {
    const redis = getRedisClient();
    const m = month || new Date().toISOString().substring(0, 7);

    const [inputTokens, outputTokens, calls, costMicroUSD] = await Promise.all([
      redis.get(`usage:tenant:${tenantId}:${m}:tokens:input`),
      redis.get(`usage:tenant:${tenantId}:${m}:tokens:output`),
      redis.get(`usage:tenant:${tenantId}:${m}:calls`),
      redis.get(`usage:tenant:${tenantId}:${m}:cost_micro_usd`),
    ]);

    const input = parseInt(inputTokens ?? "0", 10);
    const output = parseInt(outputTokens ?? "0", 10);

    return {
      inputTokens: input,
      outputTokens: output,
      totalTokens: input + output,
      calls: parseInt(calls ?? "0", 10),
      estimatedCostUSD: parseInt(costMicroUSD ?? "0", 10) / 1_000_000,
    };
  } catch (err: any) {
    logger.error("[UsageMonitor] Failed to get monthly usage", err, { tenantId });
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, calls: 0, estimatedCostUSD: 0 };
  }
}
