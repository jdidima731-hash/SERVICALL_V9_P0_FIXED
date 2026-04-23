/**
 * Redis State Manager — Centralise tout l'état global critique
 * ✅ FIX P1.3: Remplace les Map/Set en mémoire par Redis
 */

import { getRedisClient } from "./redis.client";
import { logger } from "../logger";

export class RedisStateManager {
  private _redis: any = null;
  private readonly PREFIX = "servicall:state:";

  private get redis() {
    if (!this._redis) {
      this._redis = getRedisClient();
    }
    return this._redis;
  }

  /**
   * Token Revocation Store
   */
  async addRevokedToken(jti: string, expiresAtSeconds: number): Promise<void> {
    try {
      const ttl = expiresAtSeconds - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.set(`${this.PREFIX}revoked_jwt:${jti}`, "1", "EX", ttl);
        logger.debug("[RedisStateManager] Token revoked", { jti, ttl });
      }
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to add revoked token", { jti, err: err.message });
      throw err;
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      const val = await this.redis.get(`${this.PREFIX}revoked_jwt:${jti}`);
      return val !== null;
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to check token revocation", { jti, err: err.message });
      return false; // Fail open: si Redis est down, accepter le token
    }
  }

  /**
   * Call Locks (Twilio Duplicate Prevention)
   */
  async addCallLock(phoneNumber: string, durationMs: number = 30000): Promise<void> {
    try {
      await this.redis.set(
        `${this.PREFIX}call_lock:${phoneNumber}`,
        "1",
        "PX",
        durationMs
      );
      logger.debug("[RedisStateManager] Call lock added", { phoneNumber, durationMs });
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to add call lock", { phoneNumber, err: err.message });
    }
  }

  async hasCallLock(phoneNumber: string): Promise<boolean> {
    try {
      const val = await this.redis.get(`${this.PREFIX}call_lock:${phoneNumber}`);
      return val !== null;
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to check call lock", { phoneNumber, err: err.message });
      return false;
    }
  }

  /**
   * IP Blocking
   */
  async blockIP(ip: string, durationSeconds: number = 3600): Promise<void> {
    try {
      await this.redis.set(
        `${this.PREFIX}blocked_ip:${ip}`,
        "1",
        "EX",
        durationSeconds
      );
      logger.info("[RedisStateManager] IP blocked", { ip, durationSeconds });
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to block IP", { ip, err: err.message });
    }
  }

  async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const val = await this.redis.get(`${this.PREFIX}blocked_ip:${ip}`);
      return val !== null;
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to check IP block", { ip, err: err.message });
      return false;
    }
  }

  async unblockIP(ip: string): Promise<void> {
    try {
      await this.redis.del(`${this.PREFIX}blocked_ip:${ip}`);
      logger.info("[RedisStateManager] IP unblocked", { ip });
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to unblock IP", { ip, err: err.message });
    }
  }

  /**
   * Active Calls Tracking
   */
  async setActiveCall(callId: string, callData: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.redis.set(
        `${this.PREFIX}active_call:${callId}`,
        JSON.stringify(callData),
        "EX",
        ttlSeconds
      );
      logger.debug("[RedisStateManager] Active call tracked", { callId, ttlSeconds });
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to set active call", { callId, err: err.message });
    }
  }

  async getActiveCall(callId: string): Promise<Record<string, any> | null> {
    try {
      const val = await this.redis.get(`${this.PREFIX}active_call:${callId}`);
      return val ? JSON.parse(val) : null;
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to get active call", { callId, err: err.message });
      return null;
    }
  }

  async deleteActiveCall(callId: string): Promise<void> {
    try {
      await this.redis.del(`${this.PREFIX}active_call:${callId}`);
      logger.debug("[RedisStateManager] Active call deleted", { callId });
    } catch (err: any) {
      logger.error("[RedisStateManager] Failed to delete active call", { callId, err: err.message });
    }
  }
}

export const redisStateManager = new RedisStateManager();
