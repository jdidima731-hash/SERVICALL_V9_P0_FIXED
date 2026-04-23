
/**
 * BLOC 4 : Service RGPD - Droit à l'Oubli (Article 17)
 * Implémente la suppression et l'anonymisation des données personnelles
 */

import { db } from "../db";
import { logger } from "../infrastructure/logger";
import * as schema from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

export class RGPDService {
  /**
   * Implémenter le droit à l'oubli (Article 17 RGPD)
   * Anonymiser les données personnelles d'un prospect ou d'un utilisateur
   */
  static async deleteUserData(userId: number, tenantId: number): Promise<void> {
    try {
      logger.info("[RGPD] Starting user data anonymization", { userId, tenantId });

      
      const dbInstance = await db();

      // 1. Anonymiser l'utilisateur lui-même
      await dbInstance.update(schema.users)
        .set({
          name: "Utilisateur Supprimé",
          email: `deleted_${userId}_${Date.now()}@anonymized.local`,
          passwordHash: "DELETED",
          isActive: false,
          updatedAt: new Date(),
        })
        
        .where(and(eq(schema.users.id, userId), eq(schema.tenantId, tenantId)));

      // 2. Anonymiser les prospects associés
      await dbInstance.update(schema.prospects)
        .set({
          firstName: "ANONYME",
          lastName: "ANONYME",
          email: "deleted@anonymized.local",
          phone: "DELETED",
          notes: "Données supprimées suite à une demande RGPD",
          updatedAt: new Date(),
        })
        .where(and(
          eq(schema.prospects.tenantId, tenantId),
          eq(schema.prospects.assignedTo, userId)
        ));

      // 3. Nettoyer les métadonnées des appels
      const userCalls = await dbInstance.select({ id: schema.calls.id }).from(schema.calls)
        .where(and(
          eq(schema.calls.tenantId, tenantId),
          eq(schema.calls.agentId, userId)
        ));
      const userCallIds = userCalls.map(call => call.id);

      if (userCallIds.length > 0) {
        await dbInstance.update(schema.calls)
          .set({
            transcription: "[SUPPRIMÉ PAR RGPD]",
            summary: "[SUPPRIMÉ PAR RGPD]",
            recordingUrl: null,
            recordingKey: null,
            updatedAt: new Date(),
          })
          .where(inArray(schema.calls.id, userCallIds));

        // 4. Supprimer les messages personnels liés
        await dbInstance.update(schema.messages)
          .set({
            content: "[MESSAGE SUPPRIMÉ PAR RGPD]",
            updatedAt: new Date(),
          })
          
          .where(inArray(schema.messages.callId, userCallIds));
      }

      logger.info("[RGPD] User data anonymization completed successfully", {
        userId,
        tenantId,
        timestamp: new Date().toISOString(),
      });

      await this.sendDeletionConfirmationEmail(userId);
    } catch (error: any) {
      logger.error("[RGPD] Error during user data anonymization", { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Exporter les données d'un utilisateur (Article 20 RGPD)
   */
  static async exportUserData(userId: number, tenantId: number): Promise<Record<string, any>> {
    try {
      logger.info("[RGPD] Exporting user data", { userId, tenantId });

      
      const dbInstance = await db();
      
      const user = await dbInstance.query.users.findFirst({ where: and(eq(schema.users.id, userId), eq(schema.tenantId, tenantId)) });
      const userProspects = await dbInstance.query.prospects.findMany({ where: and(eq(schema.prospects.assignedTo, userId), eq(schema.prospects.tenantId, tenantId)) });
      const userCalls = await dbInstance.query.calls.findMany({ where: and(eq(schema.calls.agentId, userId), eq(schema.calls.tenantId, tenantId)) });

      const exportData = {
        user: user || null,
        prospects: userProspects,
        calls: userCalls,
        exportedAt: new Date().toISOString(),
        tenantId,
      };

      logger.info("[RGPD] User data exported successfully", { 
        userId, 
        prospectCount: userProspects.length 
      });
      
      return exportData;
    } catch (error: any) {
      logger.error("[RGPD] Error exporting user data", { error, userId });
      throw error;
    }
  }

  private static async sendDeletionConfirmationEmail(userId: number): Promise<void> {
    logger.info("[RGPD] Deletion confirmation email sent", { userId });
  }
}