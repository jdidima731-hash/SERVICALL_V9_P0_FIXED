/**
 * Custom Metrics — Métriques métier Prometheus
 * ✅ FIX P4.2: Suivi des KPIs applicatifs
 */

import { Counter, Histogram, Gauge, register } from "prom-client";

// ✅ FIX P4.2: Compteurs (monotoniques)

export const callsCounter = new Counter({
  name: "servicall_calls_total",
  help: "Nombre total d'appels créés",
  labelNames: ["status", "tenant_id"],
  registers: [register],
});

export const prospectCounter = new Counter({
  name: "servicall_prospects_total",
  help: "Nombre total de prospects créés",
  labelNames: ["tenant_id"],
  registers: [register],
});

export const subscriptionCounter = new Counter({
  name: "servicall_subscriptions_total",
  help: "Nombre total d'abonnements",
  labelNames: ["plan", "tenant_id"],
  registers: [register],
});

export const campaignCounter = new Counter({
  name: "servicall_campaigns_total",
  help: "Nombre total de campagnes créées",
  labelNames: ["tenant_id"],
  registers: [register],
});

export const errorsCounter = new Counter({
  name: "servicall_errors_total",
  help: "Nombre total d'erreurs",
  labelNames: ["error_type", "route"],
  registers: [register],
});

// ✅ FIX P4.2: Histogrammes (latence et durée)

export const dbQueryDuration = new Histogram({
  name: "servicall_db_query_duration_seconds",
  help: "Durée des requêtes DB",
  labelNames: ["query_type", "tenant_id"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const apiResponseTime = new Histogram({
  name: "servicall_api_response_time_seconds",
  help: "Temps de réponse API",
  labelNames: ["route", "method", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const cacheOperationDuration = new Histogram({
  name: "servicall_cache_operation_duration_seconds",
  help: "Durée des opérations de cache",
  labelNames: ["operation", "hit"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

export const callDuration = new Histogram({
  name: "servicall_call_duration_seconds",
  help: "Durée des appels",
  labelNames: ["tenant_id"],
  buckets: [10, 30, 60, 120, 300, 600],
  registers: [register],
});

// ✅ FIX P4.2: Jauges (état courant)

export const activeCallsGauge = new Gauge({
  name: "servicall_active_calls",
  help: "Nombre d'appels actifs",
  labelNames: ["tenant_id"],
  registers: [register],
});

export const activeUsersGauge = new Gauge({
  name: "servicall_active_users",
  help: "Nombre d'utilisateurs actifs",
  labelNames: ["tenant_id"],
  registers: [register],
});

export const redisConnectionsGauge = new Gauge({
  name: "servicall_redis_connections",
  help: "Nombre de connexions Redis",
  registers: [register],
});

export const dbConnectionPoolGauge = new Gauge({
  name: "servicall_db_connection_pool_size",
  help: "Taille du pool de connexions DB",
  registers: [register],
});

export const cacheHitRateGauge = new Gauge({
  name: "servicall_cache_hit_rate",
  help: "Taux de hit du cache (0-1)",
  labelNames: ["cache_type"],
  registers: [register],
});

export const queueLengthGauge = new Gauge({
  name: "servicall_queue_length",
  help: "Longueur des queues de jobs",
  labelNames: ["queue_name"],
  registers: [register],
});

// ✅ FIX P4.2: Helpers pour enregistrer les métriques

export const recordCallMetric = (
  tenantId: number,
  status: "pending" | "in_progress" | "completed" | "failed",
  duration?: number
) => {
  callsCounter.labels(status, String(tenantId)).inc();
  
  if (duration) {
    callDuration.labels(String(tenantId)).observe(duration);
  }
};

export const recordProspectMetric = (tenantId: number) => {
  prospectCounter.labels(String(tenantId)).inc();
};

export const recordSubscriptionMetric = (plan: string, tenantId: number) => {
  subscriptionCounter.labels(plan, String(tenantId)).inc();
};

export const recordErrorMetric = (errorType: string, route: string) => {
  errorsCounter.labels(errorType, route).inc();
};

export const recordDbQueryDuration = (
  queryType: string,
  tenantId: number,
  duration: number
) => {
  dbQueryDuration.labels(queryType, String(tenantId)).observe(duration);
};

export const recordApiResponseTime = (
  route: string,
  method: string,
  status: number,
  duration: number
) => {
  apiResponseTime.labels(route, method, String(status)).observe(duration);
};

export const recordCacheOperation = (
  operation: "get" | "set" | "invalidate",
  hit: boolean,
  duration: number
) => {
  cacheOperationDuration.labels(operation, String(hit)).observe(duration);
};

export const setActiveCalls = (tenantId: number, count: number) => {
  activeCallsGauge.labels(String(tenantId)).set(count);
};

export const setActiveUsers = (tenantId: number, count: number) => {
  activeUsersGauge.labels(String(tenantId)).set(count);
};

export const setCacheHitRate = (cacheType: string, rate: number) => {
  cacheHitRateGauge.labels(cacheType).set(rate);
};

export const setQueueLength = (queueName: string, length: number) => {
  queueLengthGauge.labels(queueName).set(length);
};
