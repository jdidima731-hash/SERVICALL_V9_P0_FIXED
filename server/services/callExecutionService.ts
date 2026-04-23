import { eq } from "drizzle-orm";
import { getDbInstance } from "../db";
import { callExecutionMetrics } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

/**
 * Service de suivi de l'exécution du workflow pour chaque appel
 * Permet de tracker les timestamps de chaque étape du workflow standard
 */

export interface CallActionResult {
  call_received?: string;
  call_ended?: string;
  data_stored?: string;
  scoring_completed?: string;
  email_sent?: string;
  sms_sent?: string;
  invoice_created?: string;
  invoice_sent?: string;
  command_validated?: string;
  appointment_scheduled?: string;
}

export class CallExecutionService {
  /**
   * Démarre le tracking d'exécution pour un appel
   */
  static async startCallExecution(callId: number, tenantId: number): Promise<number | null> {
    try {
      const db = getDbInstance();
      if (!db) {
        logger.error("[CallExecutionService] Database not available");
        return null;
      }

      const timestamps: CallActionResult = {
        call_received: new Date().toISOString(),
      };

      const result = await db.insert(callExecutionMetrics).values({
        callId,
        tenantId,
        callReceivedAt: new Date(),
        timestamps: timestamps as any,
      }).returning();

      logger.info("[CallExecutionService] Call execution started", { callId, tenantId });
      return result[0]?.id ?? null;
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to start call execution", { error, callId });
      return null;
    }
  }

  /**
   * Enregistre la fin de l'appel
   */
  static async recordCallEnded(callId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      const existing = await this.getExecutionMetrics(callId);
      if (!existing) return;

      const timestamps = (existing.timestamps as CallActionResult) || {};
      timestamps.call_ended = new Date().toISOString();

      const callDuration = existing.callReceivedAt 
        ? Math.floor((new Date().getTime() - new Date(existing.callReceivedAt).getTime()) / 1000)
        : 0;

      await db
        .update(callExecutionMetrics)
        .set({
          callEndedAt: new Date(),
          callDuration,
          timestamps: timestamps as any,
          updatedAt: new Date(),
        })
        .where(eq(callExecutionMetrics.callId, callId));

      logger.info("[CallExecutionService] Call ended recorded", { callId, callDuration });
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to record call ended", { error, callId });
    }
  }

  /**
   * Enregistre le stockage des données dans le CRM
   */
  static async recordDataStorage(callId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      const existing = await this.getExecutionMetrics(callId);
      if (!existing) return;

      const timestamps = (existing.timestamps as CallActionResult) || {};
      timestamps.data_stored = new Date().toISOString();

      await db
        .update(callExecutionMetrics)
        .set({
          dataStoredAt: new Date(),
          timestamps: timestamps as any,
          updatedAt: new Date(),
        })
        .where(eq(callExecutionMetrics.callId, callId));

      logger.info("[CallExecutionService] Data storage recorded", { callId });
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to record data storage", { error, callId });
    }
  }

  /**
   * Enregistre la complétion du scoring
   */
  static async recordScoring(callId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      const existing = await this.getExecutionMetrics(callId);
      if (!existing) return;

      const timestamps = (existing.timestamps as CallActionResult) || {};
      timestamps.scoring_completed = new Date().toISOString();

      await db
        .update(callExecutionMetrics)
        .set({
          scoringCompletedAt: new Date(),
          timestamps: timestamps as any,
          updatedAt: new Date(),
        })
        .where(eq(callExecutionMetrics.callId, callId));

      logger.info("[CallExecutionService] Scoring recorded", { callId });
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to record scoring", { error, callId });
    }
  }

  /**
   * Enregistre l'envoi d'email
   */
  static async recordEmailSent(callId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      const existing = await this.getExecutionMetrics(callId);
      if (!existing) return;

      const timestamps = (existing.timestamps as CallActionResult) || {};
      timestamps.email_sent = new Date().toISOString();

      await db
        .update(callExecutionMetrics)
        .set({
          emailSentAt: new Date(),
          timestamps: timestamps as any,
          updatedAt: new Date(),
        })
        .where(eq(callExecutionMetrics.callId, callId));

      logger.info("[CallExecutionService] Email sent recorded", { callId });
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to record email sent", { error, callId });
    }
  }

  /**
   * Enregistre l'envoi de SMS
   */
  static async recordSmsSent(callId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      const existing = await this.getExecutionMetrics(callId);
      if (!existing) return;

      const timestamps = (existing.timestamps as CallActionResult) || {};
      timestamps.sms_sent = new Date().toISOString();

      await db
        .update(callExecutionMetrics)
        .set({
          smsSentAt: new Date(),
          timestamps: timestamps as any,
          updatedAt: new Date(),
        })
        .where(eq(callExecutionMetrics.callId, callId));

      logger.info("[CallExecutionService] SMS sent recorded", { callId });
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to record SMS sent", { error, callId });
    }
  }

  /**
   * Récupère les métriques d'exécution pour un appel
   */
  static async getExecutionMetrics(callId: number) {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const results = await db
        .select()
        .from(callExecutionMetrics)
        .where(eq(callExecutionMetrics.callId, callId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to get execution metrics", { error, callId });
      return null;
    }
  }

  /**
   * Calcule le temps total d'exécution
   */
  static async getTotalExecutionTime(callId: number): Promise<number> {
    try {
      const metrics = await this.getExecutionMetrics(callId);
      if (!metrics || !metrics.callReceivedAt) return 0;

      const endTime = metrics.appointmentScheduledAt || new Date();
      const startTime = new Date(metrics.callReceivedAt);
      
      return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to calculate total execution time", { error, callId });
      return 0;
    }
  }

  /**
   * Met à jour le temps total d'exécution
   */
  static async updateTotalExecutionTime(callId: number): Promise<void> {
    try {
      const db = getDbInstance();
      if (!db) return;

      const totalTime = await this.getTotalExecutionTime(callId);

      await db
        .update(callExecutionMetrics)
        .set({
          totalExecutionTime: totalTime,
          updatedAt: new Date(),
        })
        .where(eq(callExecutionMetrics.callId, callId));

      logger.info("[CallExecutionService] Total execution time updated", { callId, totalTime });
    } catch (error: unknown) {
      logger.error("[CallExecutionService] Failed to update total execution time", { error, callId });
    }
  }
}
