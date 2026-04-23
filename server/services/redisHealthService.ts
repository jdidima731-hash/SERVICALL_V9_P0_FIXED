/**
 * Redis Health Check Service
 * Fournit des endpoints pour vérifier la santé de Redis
 */

import { logger } from "../infrastructure/logger";
import { getRedisClient } from "../infrastructure/redis/redis.client";

/**
 * Vérifier la santé de Redis avec des détails
 */
export async function getRedisHealthStatus(): Promise<{
  status: "healthy" | "unhealthy";
  message: string;
  timestamp: number;
}> {
  try {
    const redis = getRedisClient();
    await redis.ping();
    
    return {
      status: "healthy",
      message: "Redis is operational",
      timestamp: Date.now(),
    };
  } catch (error: any) {
    logger.error("[RedisHealthService] Health check error", { error });
    return {
      status: "unhealthy",
      message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : "Unknown error",
      timestamp: Date.now(),
    };
  }
}

/**
 * Obtenir des statistiques Redis
 */
export async function getRedisStats(): Promise<{
  connected: boolean;
  uptime?: number;
  usedMemory?: string;
  connectedClients?: number;
  error?: string;
}> {
  try {
    const redis = getRedisClient();
    const info = await redis.info();

    // Parser les informations
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const clientsMatch = info.match(/connected_clients:(\d+)/);

    return {
      connected: true,
      uptime: uptimeMatch?.[1] !== undefined ? parseInt(uptimeMatch[1]!) : undefined,
      usedMemory: memoryMatch?.[1] !== undefined ? memoryMatch[1]!.trim() : undefined,
      connectedClients: clientsMatch?.[1] !== undefined ? parseInt(clientsMatch[1]!) : undefined,
    };
  } catch (error: any) {
    logger.error("[RedisHealthService] Failed to get Redis stats", { error });
    return {
      connected: false,
      error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : "Unknown error",
    };
  }
}
