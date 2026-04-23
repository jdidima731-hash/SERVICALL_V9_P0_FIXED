/**
 * Types centralisés pour éviter les imports circulaires
 * et réduire la charge mémoire TypeScript
 */

// Re-export des types communs
export type { AppMode } from "../env";

// Types de base pour les entités
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Types pour les queues
export type QueueType =
  | "sms-campaigns"
  | "email-campaigns"
  | "call-analysis"
  | "report-generation"
  | "ai-transcription"
  | "sentiment-analysis"
  | "appointment-reminders"
  | "invoice-generation"
  | "outbound-calls";

// Types pour le rate limiting
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// Types pour les health checks
export interface HealthStatus {
  status: "healthy" | "unhealthy";
  message: string;
  timestamp: number;
}

// Types pour Redis
export interface RedisStats {
  connected: boolean;
  uptime?: number;
  usedMemory?: string;
  connectedClients?: number;
  error?: string;
}

// Types pour les queues stats
export interface QueueStats {
  queueName: string;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  waiting: number;
  paused: number;
}
