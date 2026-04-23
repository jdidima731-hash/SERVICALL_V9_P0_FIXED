/**
 * Audit Service — Enregistrement des actions utilisateurs critiques
 * ✅ FIX P5.2: Traçabilité complète des événements de sécurité et métier
 */

import { logger } from "../logger";
import { db } from "../../db";
import { securityAuditLogs } from "../../../drizzle/schema";

export enum AuditAction {
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  USER_CREATE = "USER_CREATE",
  USER_UPDATE = "USER_UPDATE",
  USER_DELETE = "USER_DELETE",
  TENANT_CREATE = "TENANT_CREATE",
  TENANT_UPDATE = "TENANT_UPDATE",
  TENANT_DELETE = "TENANT_DELETE",
  PROSPECT_CREATE = "PROSPECT_CREATE",
  PROSPECT_UPDATE = "PROSPECT_UPDATE",
  PROSPECT_DELETE = "PROSPECT_DELETE",
  CALL_INITIATE = "CALL_INITIATE",
  CALL_COMPLETE = "CALL_COMPLETE",
  BILLING_TRANSACTION = "BILLING_TRANSACTION",
  API_KEY_CREATE = "API_KEY_CREATE",
  API_KEY_REVOKE = "API_KEY_REVOKE",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  ROLE_CHANGE = "ROLE_CHANGE",
  SETTINGS_UPDATE = "SETTINGS_UPDATE",
  METRICS_ACCESS = "METRICS_ACCESS",
  WEBHOOK_RECEIVE = "WEBHOOK_RECEIVE",
}

export class AuditService {
  /**
   * ✅ FIX P5.2: Enregistrer une action d'audit
   */
  async logAction(
    action: AuditAction,
    userId: number | null,
    tenantId: number | null,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      const logEntry = {
        action,
        userId,
        tenantId,
        createdAt: new Date(),
        metadata: details,
      };

      // Enregistrer dans la base de données
      await db.insert(securityAuditLogs).values(logEntry);

      // Toujours logger pour l'observabilité immédiate
      logger.info("[AuditService] Action logged", logEntry);
    } catch (error: any) {
      logger.error("[AuditService] Failed to log action", {
        action,
        userId,
        tenantId,
        error: error.message,
      });
    }
  }

  /**
   * ✅ FIX P5.2: Enregistrer une tentative de connexion échouée
   */
  async logFailedLogin(email: string, ip: string, reason: string): Promise<void> {
    try {
      const logEntry = {
        action: AuditAction.USER_LOGIN,
        userId: null,
        tenantId: null,
        createdAt: new Date(),
        metadata: { email, ip, success: false, reason },
      };

      await db.insert(securityAuditLogs).values(logEntry);
      logger.warn("[AuditService] Failed login attempt", logEntry);
    } catch (error: any) {
      logger.error("[AuditService] Failed to log failed login", {
        email,
        ip,
        error: error.message,
      });
    }
  }
}

export const auditService = new AuditService();
