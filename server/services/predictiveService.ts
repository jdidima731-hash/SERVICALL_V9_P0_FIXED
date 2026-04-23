import { eq, and } from "drizzle-orm";
import { getDbInstance } from "../db";
import { 
  predictiveScores, 
  type InsertPredictiveScore, 
  customerInvoices, 
  callScoring 
} from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { RiskFactorsSchema, type RiskFactors } from "../../shared/validation/ai";

/**
 * Service d'IA prédictive V1
 * ✅ BLOC 1 HARDENING: JSONB + Typage Strict
 */

export class PredictiveService {
  /**
   * Calcule la probabilité d'acceptation d'une facture
   */
  private static async calculateAcceptanceProbability(
    prospectId?: number,
    invoiceAmount?: number,
    callScore?: number
  ): Promise<number> {
    let probability = 0.5;

    if (callScore !== undefined) {
      if (callScore >= 80) probability += 0.3;
      else if (callScore >= 60) probability += 0.2;
      else if (callScore >= 40) probability += 0.1;
      else probability -= 0.1;
    }

    if (prospectId) {
      const db = getDbInstance();
      const previousInvoices = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.prospectId, prospectId));

      const acceptedCount = previousInvoices.filter((inv) => inv.status === "accepted").length;
      const totalCount = previousInvoices.length;

      if (totalCount > 0) {
        const acceptanceRate = acceptedCount / totalCount;
        probability = probability * 0.5 + acceptanceRate * 0.5;
      }
    }

    if (invoiceAmount !== undefined) {
      if (invoiceAmount < 100) probability += 0.1;
      else if (invoiceAmount > 1000) probability -= 0.1;
    }

    return Math.max(0, Math.min(1, probability));
  }

  /**
   * Estime le délai de paiement en jours
   */
  private static async estimatePaymentDelay(
    prospectId?: number,
    invoiceAmount?: number
  ): Promise<number> {
    let delay = 15;

    if (prospectId) {
      const db = getDbInstance();
      const paidInvoices = await db
        .select()
        .from(customerInvoices)
        .where(and(
          eq(customerInvoices.prospectId, prospectId),
          eq(customerInvoices.paymentStatus, "paid")
        ));

      if (paidInvoices.length > 0) {
        let totalDelay = 0;
        let count = 0;

        for (const invoice of paidInvoices) {
          if (invoice.sentAt && invoice.paidAt) {
            const sentDate = new Date(invoice.sentAt);
            const paidDate = new Date(invoice.paidAt);
            const delayDays = Math.floor((paidDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
            totalDelay += delayDays;
            count++;
          }
        }

        if (count > 0) {
          delay = Math.round(totalDelay / count);
        }
      }
    }

    if (invoiceAmount !== undefined) {
      if (invoiceAmount > 1000) delay += 5;
      if (invoiceAmount > 5000) delay += 10;
    }

    return Math.max(1, delay);
  }

  /**
   * Identifie les facteurs de risque
   */
  private static identifyRiskFactors(
    acceptanceProbability: number,
    paymentDelay: number,
    invoiceAmount?: number
  ): RiskFactors {
    const risks: RiskFactors = [];

    if (acceptanceProbability < 0.5) {
      risks.push({ factor: "Low acceptance probability", impact: "high", description: `Predicted: ${Math.round(acceptanceProbability * 100)}%` });
    }

    if (paymentDelay > 30) {
      risks.push({ factor: "Long payment delay", impact: "medium", description: `Estimated: ${paymentDelay} days` });
    }

    if (invoiceAmount && invoiceAmount > 5000) {
      risks.push({ factor: "High invoice amount", impact: "medium" });
    }

    return RiskFactorsSchema.parse(risks);
  }

  /**
   * Génère une prédiction complète pour une facture
   */
  static async predictForInvoice(invoiceId: number): Promise<boolean> {
    try {
      const db = getDbInstance();
      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) return false;
      const invoice = invoiceResults[0];

      let callScore: number | undefined;
      if (invoice.callId) {
        const scoreResults = await db
          .select()
          .from(callScoring)
          .where(eq(callScoring.callId, invoice.callId))
          .limit(1);

        if (scoreResults.length > 0) {
          callScore = scoreResults[0].overallScore || undefined;
        }
      }

      const probAcc = await this.calculateAcceptanceProbability(
        invoice.prospectId || undefined,
        parseFloat(String(invoice.amount)),
        callScore
      );

      const estDelay = await this.estimatePaymentDelay(
        invoice.prospectId || undefined,
        parseFloat(String(invoice.amount))
      );

      const risks = this.identifyRiskFactors(probAcc, estDelay, parseFloat(String(invoice.amount)));

      const predictionData: InsertPredictiveScore = {
        tenantId: invoice.tenantId!,
        prospectId: invoice.prospectId!,
        invoiceId,
        probabilityAcceptance: probAcc.toString(),
        estimatedPaymentDelay: estDelay,
        riskFactors: risks,
        successProbability: probAcc.toString(), // Simplified for V1
        recommendedChannel: "email",
        recommendedTime: "09:00-11:00",
        scoreType: "payment_prediction"
      };

      await db.insert(predictiveScores).values(predictionData);
      return true;

    } catch (error: unknown) {
      logger.error("[PredictiveService] Failed to generate prediction", { error, invoiceId });
      return false;
    }
  }
}
