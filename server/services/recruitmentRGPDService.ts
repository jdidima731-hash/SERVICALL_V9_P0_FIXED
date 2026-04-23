import { db } from "../db";
import { CandidateInterview, candidateInterviews } from "../../drizzle/schema-recruitment";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "../infrastructure/logger";
import { encryptionService } from "./encryptionService";
import * as Sentry from "@sentry/node";

/**
 * Service RGPD pour le module de recrutement
 * Gère l'anonymisation, la suppression et la rétention des données candidats
 */

export class RecruitmentRGPDService {
  /**
   * Anonymiser un entretien candidat (RGPD - Droit à l'oubli)
   */
  async anonymizeInterview(interviewId: number, tenantId: number): Promise<void> {
    try {
      logger.info("[RecruitmentRGPD] Anonymizing interview", { interviewId, tenantId });

      // Vérifier que l'entretien appartient au tenant
      const interview = await db.query.candidateInterviews.findFirst({
        where: and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ),
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found for tenant ${tenantId}`);
      }

      if (interview.anonymized) {
        logger.warn("[RecruitmentRGPD] Interview already anonymized", { interviewId });
        return;
      }

      // Anonymiser les données personnelles
      await db.update(candidateInterviews)
        .set({
          
          candidateName: await encryptionService.encrypt("ANONYMISÉ", { tenantId, dataType: 'personal' }),
          candidateEmail: null,
          
          candidatePhone: await encryptionService.encrypt("ANONYMISÉ", { tenantId, dataType: 'personal' }),
          transcript: null, // Supprimer le transcript complet
          recordingUrl: null, // Supprimer l'enregistrement
          employerNotes: null,
          anonymized: true,
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));

      logger.info("[RecruitmentRGPD] Interview anonymized successfully", { interviewId });
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to anonymize interview", { error, interviewId });
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Supprimer définitivement un entretien (RGPD - Droit à l'effacement)
   */
  async deleteInterview(interviewId: number, tenantId: number): Promise<void> {
    try {
      logger.info("[RecruitmentRGPD] Deleting interview", { interviewId, tenantId });

      // Vérifier que l'entretien appartient au tenant
      const interview = await db.query.candidateInterviews.findFirst({
        where: and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ),
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found for tenant ${tenantId}`);
      }

      // Supprimer définitivement
      await db.delete(candidateInterviews)
        .where(eq(candidateInterviews.id, interviewId));

      logger.info("[RecruitmentRGPD] Interview deleted successfully", { interviewId });
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to delete interview", { error, interviewId });
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Nettoyer automatiquement les entretiens expirés (CRON)
   * Anonymise ou supprime les entretiens dont la période de rétention est dépassée
   */
  async cleanExpiredInterviews(): Promise<void> {
    try {
      logger.info("[RecruitmentRGPD] Starting cleanup of expired interviews");

      const now = new Date();

      // Récupérer tous les entretiens expirés
      const expiredInterviews = await db.query.candidateInterviews.findMany({
        where: and(
          lte(candidateInterviews.dataRetentionUntil, now),
          eq(candidateInterviews.anonymized, false)
        ),
      });

      logger.info("[RecruitmentRGPD] Found expired interviews", { count: expiredInterviews.length });

      for (const interview of expiredInterviews) {
        try {
          // Anonymiser plutôt que supprimer pour conserver les statistiques
          await this.anonymizeInterview(interview.id, interview.tenantId);
        } catch (error: any) {
          logger.error("[RecruitmentRGPD] Failed to anonymize expired interview", {
            error,
            interviewId: interview.id,
          });
          // Continuer avec les autres entretiens
        }
      }

      logger.info("[RecruitmentRGPD] Cleanup completed", { processed: expiredInterviews.length });
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to clean expired interviews", { error });
      Sentry.captureException(error);
    }
  }

  /**
   * Exporter les données d'un candidat (RGPD - Droit à la portabilité)
   */
  async exportCandidateData(interviewId: number, tenantId: number): Promise<any> {
    try {
      logger.info("[RecruitmentRGPD] Exporting candidate data", { interviewId, tenantId });

      const interview = await db.query.candidateInterviews.findFirst({
        where: and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ),
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found for tenant ${tenantId}`);
      }

      if (interview.anonymized) {
        throw new Error("Cannot export anonymized data");
      }

      // Déchiffrer les données sensibles
      const candidateName = interview.candidateName
        
        ? await encryptionService.decrypt(interview.candidateName, { tenantId, dataType: 'personal' })
        : null;
      const candidateEmail = interview.candidateEmail
        
        ? await encryptionService.decrypt(interview.candidateEmail, { tenantId, dataType: 'personal' })
        : null;
      const candidatePhone = interview.candidatePhone
        
        ? await encryptionService.decrypt(interview.candidatePhone, { tenantId, dataType: 'personal' })
        : null;

      // Préparer l'export
      const exportData = {
        personalData: {
          name: candidateName,
          email: candidateEmail,
          phone: candidatePhone,
        },
        interviewData: {
          jobPosition: interview.jobPosition,
          businessType: interview.businessType,
          scheduledAt: interview.scheduledAt,
          startedAt: interview.startedAt,
          completedAt: interview.completedAt,
          duration: interview.duration,
          status: interview.status,
        },
        analysis: {
          transcript: interview.transcript,
          notesJson: interview.notesJson,
          aiSummary: interview.aiSummary,
          aiRecommendation: interview.aiRecommendation,
          aiConfidence: interview.aiConfidence,
        },
        metadata: {
          createdAt: interview.createdAt,
          updatedAt: interview.updatedAt,
          dataRetentionUntil: interview.dataRetentionUntil,
        },
      };

      logger.info("[RecruitmentRGPD] Candidate data exported successfully", { interviewId });
      return exportData;
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to export candidate data", { error, interviewId });
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Vérifier le consentement pour un entretien
   */
  async verifyConsent(interviewId: number, tenantId: number): Promise<boolean> {
    try {
      const interview = await db.query.candidateInterviews.findFirst({
        where: and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ),
      });

      if (!interview) {
        return false;
      }

      return interview.consentGiven ?? false;
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to verify consent", { error, interviewId });
      return false;
    }
  }

  /**
   * Mettre à jour le consentement
   */
  async updateConsent(interviewId: number, tenantId: number, consent: boolean): Promise<void> {
    try {
      logger.info("[RecruitmentRGPD] Updating consent", { interviewId, tenantId, consent });

      await db.update(candidateInterviews)
        .set({
          consentGiven: consent,
          updatedAt: new Date(),
        })
        .where(and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ));

      logger.info("[RecruitmentRGPD] Consent updated successfully", { interviewId });
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to update consent", { error, interviewId });
      throw error;
    }
  }

  /**
   * Obtenir un rapport de conformité RGPD pour un tenant
   */
  async getComplianceReport(tenantId: number): Promise<any> {
    try {
      logger.info("[RecruitmentRGPD] Generating compliance report", { tenantId });

      const interviews = await db.query.candidateInterviews.findMany({
        where: eq(candidateInterviews.tenantId, tenantId),
      });

      const now = new Date();

      const report = {
        totalInterviews: interviews.length,
        anonymizedInterviews: interviews.filter((i: CandidateInterview) => i.anonymized).length,
        withConsent: interviews.filter((i: CandidateInterview) => i.consentGiven).length,
        withoutConsent: interviews.filter((i: CandidateInterview) => !i.consentGiven).length,
        expired: interviews.filter((i: CandidateInterview) => i.dataRetentionUntil && i.dataRetentionUntil < now).length,
        activeRetention: interviews.filter((i: CandidateInterview) => i.dataRetentionUntil && i.dataRetentionUntil >= now).length,
        complianceRate: interviews.length > 0
          ? ((interviews.filter((i: CandidateInterview) => i.consentGiven).length / interviews.length) * 100).toFixed(2)
          : "0.00",
      };

      logger.info("[RecruitmentRGPD] Compliance report generated", { tenantId, report });
      return report;
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to generate compliance report", { error, tenantId });
      throw error;
    }
  }

  /**
   * Prolonger la période de rétention
   */
  async extendRetention(interviewId: number, tenantId: number, additionalDays: number): Promise<void> {
    try {
      logger.info("[RecruitmentRGPD] Extending retention period", {
        interviewId,
        tenantId,
        additionalDays,
      });

      const interview = await db.query.candidateInterviews.findFirst({
        where: and(
          eq(candidateInterviews.id, interviewId),
          eq(candidateInterviews.tenantId, tenantId)
        ),
      });

      if (!interview) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      const currentRetention = interview.dataRetentionUntil || new Date();
      const newRetention = new Date(currentRetention);
      newRetention.setDate(newRetention.getDate() + additionalDays);

      await db.update(candidateInterviews)
        .set({
          dataRetentionUntil: newRetention,
          updatedAt: new Date(),
        })
        .where(eq(candidateInterviews.id, interviewId));

      logger.info("[RecruitmentRGPD] Retention period extended", {
        interviewId,
        newRetention,
      });
    } catch (error: any) {
      logger.error("[RecruitmentRGPD] Failed to extend retention", { error, interviewId });
      throw error;
    }
  }
}

export const recruitmentRGPDService = new RecruitmentRGPDService();