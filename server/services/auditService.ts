import { getDbInstance } from "../db";
import { auditLogs, InsertAuditLog } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { eq, desc, and, gte, lte } from "drizzle-orm";

/**
 * Service d'Audit - Traçabilité Totale et Conformité Juridique
 * ✅ BLOC 5 : Améliorations de la traçabilité technique
 * Enregistre chaque action critique avec contexte utilisateur, tenant et impact RGPD.
 */

export type AuditAction = 
  // Facturation
  | "INVOICE_CREATE" | "INVOICE_SEND" | "INVOICE_ACCEPT" | "INVOICE_PAYMENT"
  // IA & Scoring
  | "IA_VALIDATION" | "IA_PREDICTION" | "IA_SCORING_EXECUTION" | "IA_PROMPT_UPDATE"
  // Authentification & Sécurité
  | "USER_LOGIN" | "USER_LOGOUT" | "PASSWORD_CHANGE" | "SECURITY_ALERT" | "PII_ACCESS"
  | "API_KEY_UPDATED" | "TENANT_SETTINGS_CHANGED" | "CROSS_TENANT_ACCESS_ATTEMPT"
  // RGPD
  | "DATA_EXPORT" | "DATA_ANONYMIZE" | "CONSENT_GRANTED" | "CONSENT_REVOKED" | "RIGHT_TO_BE_FORGOTTEN"
  // Téléphonie & Communication
  | "CALL_INITIATED" | "CALL_COMPLETED" | "RECORDING_ACCESS" | "SMS_SENT" | "EMAIL_SENT" | "WHATSAPP_SENT"
  // Système & CRUD
  | "RESOURCE_CREATE" | "RESOURCE_UPDATE" | "RESOURCE_DELETE"
  | "WORKFLOW_ACTIVATED" | "WORKFLOW_DEACTIVATED" | "CAMPAIGN_STARTED";

export type ActorType = "human" | "ai" | "system";
export type AuditSource = "API" | "IA" | "TWILIO" | "SYSTEM" | "WEBHOOK";

export interface AuditContext {
  tenantId: number;
  userId: number;
  action: AuditAction;
  resource: string;
  resourceId?: number | string;
  actorType: ActorType;
  source: AuditSource;
  ipAddress?: string;
  userAgent?: string;
  impactRGPD?: boolean;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Enregistre une action critique dans le journal d'audit immuable
   */
  static async log(context: AuditContext): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) {
        logger.error("[AuditService] Database not available for audit logging");
        return false;
      }

      // Détermination automatique de l'impact RGPD si non fourni
      const impactRGPD = context.impactRGPD ?? this.isRGPDImpactful(context.action);
      
      const metadata = {
        ...(context.metadata || {}),
        source: context.source,
        baseLegale: this.getBaseLegale(context.action),
        conformite: "RGPD_EU_2016_679",
        impactRGPD: impactRGPD ? "YES" : "NO",
        timestamp_utc: new Date().toISOString()
      };

      const auditData: InsertAuditLog = {
        tenantId: context.tenantId,
        userId: context.userId,
        action: context.action,
        resource: context.resource,
        resourceId: typeof context.resourceId === 'number' ? context.resourceId : undefined,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          ...metadata,
          resourceId: context.resourceId,
          actorType: context.actorType,
        },
        createdAt: new Date(),
      };

      await db.insert(auditLogs).values(auditData);

      // Logging technique structuré en parallèle
      logger.info(`[AUDIT] ${context.action} | Resource: ${context.resource} | RGPD: ${impactRGPD ? 'YES' : 'NO'}`, {
        tenantId: context.tenantId,
        userId: context.userId,
        action: context.action,
        source: context.source,
        impactRGPD
      });

      return true;
    } catch (error: any) {
      logger.error("[AuditService] Failed to record audit log", { error, context });
      return false;
    }
  }

  /**
   * Détermine si une action a un impact RGPD (traitement de PII)
   */
  private static isRGPDImpactful(action: AuditAction): boolean {
    const rgpdActions: AuditAction[] = [
      "DATA_EXPORT", "DATA_ANONYMIZE", "CONSENT_GRANTED", "CONSENT_REVOKED", 
      "RIGHT_TO_BE_FORGOTTEN", "PII_ACCESS", "RECORDING_ACCESS", "CALL_INITIATED", "SMS_SENT", "EMAIL_SENT", "WHATSAPP_SENT"
    ];
    return rgpdActions.includes(action);
  }

  /**
   * Retourne la base légale associée à l'action selon le RGPD
   */
  private static getBaseLegale(action: AuditAction): string {
    switch (action) {
      case "CONSENT_GRANTED":
      case "CONSENT_REVOKED":
        return "Art. 6(1)(a) - Consentement";
      case "RIGHT_TO_BE_FORGOTTEN":
      case "DATA_ANONYMIZE":
        return "Art. 17 - Droit à l'effacement";
      case "DATA_EXPORT":
        return "Art. 20 - Droit à la portabilité";
      case "PII_ACCESS":
      case "CALL_INITIATED":
      case "SMS_SENT":
      case "EMAIL_SENT":
      case "WHATSAPP_SENT":
        return "Art. 6(1)(b) - Nécessité contractuelle";
      case "INVOICE_CREATE":
      case "INVOICE_PAYMENT":
        return "Art. 6(1)(c) - Obligation légale";
      default:
        return "Art. 6(1)(f) - Intérêt légitime";
    }
  }

  /**
   * Récupère les logs d'audit pour un tenant
   */
  static async getTenantLogs(tenantId: number, limit = 100, offset = 0) {
    try {
      const db = getDbInstance();
      if (!db) return [];

      return await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error: any) {
      logger.error("[AuditService] Failed to fetch audit logs", { error, tenantId });
      return [];
    }
  }

  /**
   * Récupère les logs d'audit pour une ressource spécifique
   */
  static async getLogsForResource(tenantId: number, resource: string, resourceId: string | number, limit = 50) {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const id = typeof resourceId === 'string' ? parseInt(resourceId, 10) : resourceId;
      if (isNaN(id)) return [];

      return await db
        .select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.resource, resource),
          eq(auditLogs.resourceId, id)
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
    } catch (error: any) {
      logger.error(`[AuditService] Failed to fetch logs for resource ${resource}:${resourceId}`, { error, tenantId });
      return [];
    }
  }

  /**
   * Récupère les logs d'audit pour une période donnée
   */
  static async getLogsForPeriod(tenantId: number, startDate: Date, endDate: Date) {
    try {
      const db = getDbInstance();
      if (!db) return [];

      return await db
        .select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.tenantId, tenantId),
          gte(auditLogs.createdAt, startDate),
          lte(auditLogs.createdAt, endDate)
        ))
        .orderBy(desc(auditLogs.createdAt));
    } catch (error: any) {
      logger.error(`[AuditService] Failed to fetch logs for period`, { error, tenantId });
      return [];
    }
  }
}
