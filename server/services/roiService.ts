/**
 * BLOC 5 - ROI Service
 * Calcule les indicateurs de performance et le retour sur investissement
 */

import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

export interface ROIMetrics {
  timeSavedMinutes: number;
  moneySavedEuro: number;
  aiConversionRate: number;
  totalCallsHandled: number;
  aiSuggestionsApproved: number;
  humanLaborCostSaved: number;
}

export class ROIService {
  // Constantes de calcul (basées sur des moyennes industrielles)
  private static COST_PER_MINUTE_HUMAN = 0.50; // 30€/h chargé
  private static TIME_SAVED_PER_AI_MSG = 3;    // 3 minutes par message de relance
  private static TIME_SAVED_PER_CALL_EXTRACTION = 5; // 5 minutes par saisie manuelle évitée

  /**
   * Calcule le ROI pour un tenant sur une période donnée
   */
  static async calculateTenantROI(tenantId: number, days: number = 30): Promise<ROIMetrics> {
    const db = getDbInstance();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      // 1. Nombre de suggestions IA exécutées (Bloc 3)
      const suggestions = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.aiSuggestions)
        .where(
          and(
            eq(schema.aiSuggestions.tenantId, tenantId),
            eq(schema.aiSuggestions.status, "executed"),
            gte(schema.aiSuggestions.updatedAt, startDate)
          )
        );
      
      const executedCount = Number(suggestions[0]?.count ?? 0);

      // 2. Nombre d'appels totaux
      const calls = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.calls)
        .where(
          and(
            eq(schema.calls.tenantId, tenantId),
            gte(schema.calls.createdAt, startDate)
          )
        );
      
      const totalCalls = Number(calls[0]?.count ?? 0);

      // 3. Calcul du temps gagné
      // (Messages de relance IA + Extractions de données Bloc 4)
      const timeSaved = (executedCount * this.TIME_SAVED_PER_AI_MSG) + 
                        (totalCalls * 0.4 * this.TIME_SAVED_PER_CALL_EXTRACTION); // Estime 40% d'appels avec extraction

      // 4. Calcul de l'argent économisé
      const moneySaved = timeSaved * this.COST_PER_MINUTE_HUMAN;

      // 5. Taux de conversion IA (Suggestions approuvées / Suggestions totales)
      const totalSuggestions = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.aiSuggestions)
        .where(eq(schema.aiSuggestions.tenantId, tenantId));
      
      const totalSuggCount = Number(totalSuggestions[0]?.count ?? 1);
      const conversionRate = (executedCount / totalSuggCount) * 100;

      return {
        timeSavedMinutes: Math.round(timeSaved),
        moneySavedEuro: Math.round(moneySaved),
        aiConversionRate: Math.round(conversionRate),
        totalCallsHandled: totalCalls,
        aiSuggestionsApproved: executedCount,
        humanLaborCostSaved: Math.round(moneySaved * 0.8) // Estimation marge nette
      };
    } catch (error: any) {
      logger.error("[ROI Service] Error calculating ROI", { error, tenantId });
      return {
        timeSavedMinutes: 0,
        moneySavedEuro: 0,
        aiConversionRate: 0,
        totalCallsHandled: 0,
        aiSuggestionsApproved: 0,
        humanLaborCostSaved: 0
      };
    }
  }
}
