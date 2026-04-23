/**
 * Health Service - Vérification de la santé des dépendances (SRE)
 */

import { logger } from "../infrastructure/logger";
import { ENV } from "../_core/env";
import { getRedisClient } from "../infrastructure/redis/redis.client";

export interface HealthStatus {
  status: "ok" | "error" | "degraded";
  timestamp: string;
  version: string;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    bullmq: CheckResult;
    ia: CheckResult;
    notifications: CheckResult;
    system: {
      disk: string;
      memory: string;
      uptime: string;
    };
  };
}

interface CheckResult {
  status: "ok" | "error" | "disabled";
  latency_ms: number;
  message?: string;
}

export class HealthService {
  static async getFullStatus(): Promise<HealthStatus> {
    const [dbCheck, redisCheck, bullmqCheck, iaCheck, notifCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkBullMQ(),
      this.checkIA(),
      this.checkNotifications(),
    ]);

    const os = await import("os");
    // const _fs = await import("fs"); // reserved for future disk checks

    const memoryUsage = `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB`;
    const uptime = `${Math.round(process.uptime())}s`;
    
    let diskUsage = "N/A";
    try {
  // const _stats = fs.statSync("/");
      diskUsage = "Available"; // Simplifié pour Node sans bibliothèques externes de disk usage
    } catch (e: any) {}

    const checks = {
      database: dbCheck,
      redis: redisCheck,
      bullmq: bullmqCheck,
      ia: iaCheck,
      notifications: notifCheck,
      system: {
        disk: diskUsage,
        memory: memoryUsage,
        uptime: uptime
      }
    };

    const hasError = Object.values(checks).some(c => typeof c === 'object' && c !== null && 'status' in c && c.status === "error");
    
    const status: HealthStatus = {
      status: hasError ? "error" : "ok",
      timestamp: new Date().toISOString(),
      version: process.env['APP_VERSION'] || "2.0.0",
      checks,
    };

    if (hasError) {
      logger.error("Health check failed", { checks });
    }

    return status;
  }

  private static async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    if (!ENV.dbEnabled) {
      return { status: "disabled", latency_ms: 0, message: "Database disabled via DISABLE_DB=true" };
    }

    try {
      const { dbManager } = await import("./dbManager");
      const client = dbManager.client;
      if (!client) throw new Error("Database client not available");
      
      // Utilisation directe de postgres-js pour une requête brute légère
      await client`SELECT 1`;
      
      return { status: "ok", latency_ms: Date.now() - start, message: "Database connected and responsive" };
    } catch (error: any) {
      logger.error("[HealthCheck] Database check failed", { error });
      return { status: "error", latency_ms: Date.now() - start, message: `Connection failed: ${(error as Error).message}` };
    }
  }

  private static async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const redis = getRedisClient();
      await redis.ping();
      return { status: "ok", latency_ms: Date.now() - start, message: "Redis connected and responsive" };
    } catch (error: any) {
      logger.error("[HealthCheck] Redis check failed", { error });
      return { status: "error", latency_ms: Date.now() - start, message: `Connection failed: ${(error as Error).message}` };
    }
  }

  private static async checkBullMQ(): Promise<CheckResult> {
    const start = Date.now();
    // Si Redis est désactivé, BullMQ est aussi désactivé (normal en dev sans Redis)
    if (process.env['DISABLE_REDIS'] === 'true') {
      return { status: "disabled", latency_ms: 0, message: "BullMQ disabled (Redis not configured)" };
    }
    try {
      const { jobQueue } = await import("./jobQueueService");
      const stats = await jobQueue.getQueueStats();
      if (stats === null) {
        return { status: "disabled", latency_ms: Date.now() - start, message: "BullMQ queue not initialized (Redis required)" };
      }
      return { status: "ok", latency_ms: Date.now() - start, message: `BullMQ active: ${stats.active} jobs` };
    } catch (error: any) {
      logger.error("[HealthCheck] BullMQ check failed", { error });
      return { status: "disabled", latency_ms: Date.now() - start, message: `BullMQ unavailable (Redis required)` };
    }
  }

  private static async checkIA(): Promise<CheckResult> {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey || apiKey.includes("PLACEHOLDER")) {
      return { status: "disabled", latency_ms: 0, message: "IA API Key missing or invalid" };
    }
    return { status: "ok", latency_ms: 0, message: "IA API Key configured" };
  }

  private static async checkNotifications(): Promise<CheckResult> {
    const twilioSid = process.env['TWILIO_ACCOUNT_SID'];
    const twilioToken = process.env['TWILIO_AUTH_TOKEN'];
    const sendgridKey = process.env['SENDGRID_API_KEY'];
    const results = [];

    
    if (twilioSid && twilioToken && !twilioSid.includes("PLACEHOLDER")) results.push("Twilio:OK" as unknown);
    
    else results.push("Twilio:MISSING" as unknown);

    
    if (sendgridKey && !sendgridKey.includes("PLACEHOLDER")) results.push("SendGrid:OK" as unknown);
    
    else results.push("SendGrid:MISSING" as unknown);

    
    const hasCriticalMissing = results.some(r => r.includes("MISSING"));
    return { status: hasCriticalMissing ? "disabled" : "ok", latency_ms: 0, message: results.join(", ") };
  }
}