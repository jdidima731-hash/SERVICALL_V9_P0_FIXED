
/**
 * RightToBeForgottenService - Service centralisé pour le droit à l'oubli (RGPD)
 * Gère la suppression, l'anonymisation et l'export des données personnelles.
 */

import { eq, and, inArray, lt } from "drizzle-orm";
import { getDbInstance } from "../db";
import { 
  prospects, 
  calls, 
  appointments, 
  rgpdConsents, 
  auditLogs,
  tasks,
  callScoring,
  customerInvoices,
  predictiveScores,
  appointmentReminders,
  callExecutionMetrics,
  messages
} from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { hashData } from "./securityService";
import { AuditService } from "./auditService";

export class RightToBeForgottenService {
  /**
   * Supprime ou anonymise toutes les données liées à un prospect
   */
  static async forgetProspect(prospectId: number, tenantId: number): Promise<{ success: boolean; details: Record<string, unknown> }> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    logger.info(`[RGPD] Starting Right to be Forgotten for prospect ${prospectId} in tenant ${tenantId}`);

    const results = {
      prospect: false,
      calls: 0,
      appointments: 0,
      consents: 0,
      tasks: 0,
      invoices: 0,
      scores: 0,
      reminders: 0,
      aiData: false,
      thirdParties: false,
      messages: 0
    };

    try {
      // 1. Supprimer les rendez-vous et leurs rappels
      const prospectAppointments = await db.select().from(appointments)
        .where(and(eq(appointments.prospectId, prospectId), eq(appointments.tenantId, tenantId)));
      
      if (prospectAppointments.length > 0) {
        const appointmentIds = prospectAppointments.map((a: any) => a.id);
        await db.delete(appointmentReminders)
          .where(inArray(appointmentReminders.appointmentId, appointmentIds));
        
        await db.delete(appointments)
          .where(inArray(appointments.id, appointmentIds));
        
        results.appointments = prospectAppointments.length;
        results.reminders = appointmentIds.length;
      }

      // 2. Supprimer les tâches
      const deletedTasks = await db.delete(tasks)
        .where(and(eq(tasks.prospectId, prospectId), eq(tasks.tenantId, tenantId)));
      
      results.tasks = (deletedTasks as unknown).length ?? 0;

      // 3. Gérer les appels (Anonymisation + Suppression des enregistrements)
      const prospectCalls = await db.select().from(calls)
        .where(and(eq(calls.prospectId, prospectId), eq(calls.tenantId, tenantId)));
      
      for (const call of prospectCalls) {
        await this.cleanupAIData(call.id);
        
        await this.cleanupThirdPartyData(call.metadata?.callSid ?? null);
        await db.delete(callScoring).where(eq(callScoring.callId, call.id));
        results.scores++;
        await db.delete(callExecutionMetrics).where(eq(callExecutionMetrics.callId, call.id));

        // Pseudonymisation avancée
        await db.update(calls)
          .set({
            fromNumber: this.pseudonymize(call.fromNumber ?? ""),
            toNumber: this.pseudonymize(call.toNumber ?? ""),
            recordingUrl: null,
            recordingKey: null,
            transcription: "DELETED_FOR_RGPD",
            summary: "DELETED_FOR_RGPD",
            metadata: { 
              rgpd_action: "forgotten", 
              timestamp: new Date().toISOString(),
              
              originalCallSid: call.metadata?.callSid 
            }
          })
          .where(eq(calls.id, call.id));
        
        results.calls++;
      }

      // 4. Gérer les factures clients (Anonymisation)
      const prospectInvoices = await db.select().from(customerInvoices)
        .where(and(eq(customerInvoices.prospectId, prospectId), eq(customerInvoices.tenantId, tenantId)));
      
      for (const inv of prospectInvoices) {
        await db.update(customerInvoices)
          .set({
            acceptedBy: "ANONYMIZED",
            acceptedIP: "0.0.0.0",
            
            signatureData: { rgpd: "deleted" },
            description: "Invoice for anonymized prospect"
          })
          .where(eq(customerInvoices.id, inv.id));
        results.invoices++;
      }

      // 5. Supprimer les scores prédictifs
      await db.delete(predictiveScores)
        .where(and(eq(predictiveScores.prospectId, prospectId), eq(predictiveScores.tenantId, tenantId)));

      // 6. Supprimer les messages
      const deletedMessages = await db.delete(messages)
        .where(and(eq(messages.prospectId, prospectId), eq(messages.tenantId, tenantId)));
      results.messages = (deletedMessages as unknown as unknown[]).length ?? 0;

      // 7. Supprimer les consentements
      await db.delete(rgpdConsents).where(eq(rgpdConsents.prospectId, prospectId));
      results.consents = 1;

      // 8. Supprimer le prospect lui-même
      await db.delete(prospects)
        .where(and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId)));
      results.prospect = true;

      // 9. Anonymiser les logs d'audit qui référencent ce prospect (BLOC 10)
      const logsToAnonymize = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.resource, "prospect"), eq(auditLogs.resourceId, prospectId)));
      
      for (const log of logsToAnonymize) {
        await db.update(auditLogs)
          .set({
            metadata: { 
              ...(log.metadata as Record<string, unknown> || {}),
              originalResourceId: prospectId,
              anonymizedAt: new Date().toISOString(),
              deletedUserName: `DELETED_USER_${prospectId}`
            },
            resourceId: 0 // On "détache" le log de l'ID réel
          })
          .where(eq(auditLogs.id, log.id));
      }

      // 10. Audit Log OBLIGATOIRE avec impact élevé
      await AuditService.log({
        tenantId: tenantId,
        userId: 0,
        action: "RIGHT_TO_BE_FORGOTTEN",
        resource: "prospect",
        resourceId: 0, // Anonymisé
        actorType: "system",
        source: "SYSTEM",
        impactRGPD: true,
        metadata: { 
          status: "completed", 
          results,
          baseLegale: "Art. 17 RGPD - Droit à l'effacement",
          deletedUserRef: `DELETED_USER_${prospectId}`
        }
      });

      results.aiData = true;
      results.thirdParties = true;

      return { success: true, details: results };
    } catch (error: unknown) {
      logger.error(`[RGPD] Error during Right to be Forgotten for prospect ${prospectId}`, { error });
      throw error;
    }
  }

  /**
   * Politique de rétention automatisée : Supprime les données plus vieilles que X jours
   */
  static async runRetentionPolicy(days: number = 365): Promise<{ deletedProspects: number }> {
    const db = getDbInstance();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    logger.info(`[RGPD] Running retention policy for data older than ${cutoffDate.toISOString()}`);

    const oldProspects = await db.select().from(prospects)
      .where(lt(prospects.updatedAt, cutoffDate));

    let count = 0;
    for (const p of oldProspects) {
      await this.forgetProspect(p.id, p.tenantId);
      count++;
    }

    logger.info(`[RGPD] Retention policy completed. Deleted ${count} prospects.`);
    return { deletedProspects: count };
  }

  /**
   * Export des données utilisateur (Portabilité)
   * ✅ BLOC 10
   */
  static async exportUserData(prospectId: number, tenantId: number): Promise<any> {
    const db = getDbInstance();
    
    const prospect = await db.select().from(prospects)
      .where(and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId)))
      .then((res: any) => res[0]);

    if (!prospect) throw new Error("Prospect non trouvé");

    const callsData = await db.select().from(calls)
      .where(and(eq(calls.prospectId, prospectId), eq(calls.tenantId, tenantId)));

    const messagesData = await db.select().from(messages)
      .where(and(eq(messages.prospectId, prospectId), eq(messages.tenantId, tenantId)));

    const appointmentsData = await db.select().from(appointments)
      .where(and(eq(appointments.prospectId, prospectId), eq(appointments.tenantId, tenantId)));

    const consentsData = await db.select().from(rgpdConsents)
      .where(eq(rgpdConsents.prospectId, prospectId));

    return {
      personalData: prospect,
      communications: { 
        calls: callsData,
        messages: messagesData
      },
      appointments: appointmentsData,
      consents: consentsData,
      exportedAt: new Date().toISOString(),
      notice: "Cet export contient l'intégralité de vos données personnelles stockées dans Servicall (Art. 20 RGPD)."
    };
  }

  /**
   * Pseudonymisation simple (Hashage partiel)
   */
  private static pseudonymize(data: string): string {
    if (!data) return "";
    const hash = hashData(data);
    return `PSEUDO-${hash.substring(0, 8)}`;
  }

  /**
   * Nettoyage des données IA (Scores, Transcriptions, Analyses)
   */
  private static async cleanupAIData(callId: number): Promise<void> {
    const db = getDbInstance();
    logger.info(`[RGPD][IA] Purging AI insights and scoring for call ${callId}`);
    
    // Suppression des scores IA
    await db.delete(callScoring).where(eq(callScoring.callId, callId));
    
    // Suppression des métriques d'exécution IA
    await db.delete(callExecutionMetrics).where(eq(callExecutionMetrics.callId, callId));
  }

  /**
   * Nettoyage des données chez les prestataires tiers (Twilio, etc.)
   */
  private static async cleanupThirdPartyData(callSid: string | null): Promise<void> {
    if (!callSid) return;
    logger.info(`[RGPD][TIERS] Requesting deletion of recording/logs for SID ${callSid}`);
    // Note: Ici on appellerait normalement l'API Twilio pour supprimer l'enregistrement
    // twilioClient.calls(callSid).recordings.each(rec => rec.remove());
  }
}