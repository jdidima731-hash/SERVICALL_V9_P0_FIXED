
import { eq } from "drizzle-orm";
import { getDbInstance } from "../db";
import { commandValidations, InsertCommandValidation, customerInvoices, callScoring } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { CallExecutionService } from "./callExecutionService";
import { AuditService } from "./auditService";

/**
 * Service de validation des commandes
 * Combine IA + validation humaine pour sécuriser les transactions
 */

export class CommandValidationService {
  /**
   * Calcule un score de validation automatique (0-100)
   * Basé sur: score appel, montant, historique prospect
   */
  private static async calculateValidationScore(invoiceId: number): Promise<number> {
    try {
      const db = getDbInstance();
      if (!db) return 0;

      // Récupérer la facture
      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) return 0;

      const invoice = invoiceResults[0];
      let score = 50; // Score de base

      // Facteur 1: Score de l'appel
      if (invoice.callId) {
        const scoreResults = await db
          .select()
          .from(callScoring)
          .where(eq(callScoring.callId, invoice.callId))
          .limit(1);

        if (scoreResults.length > 0) {
          
          const callScore = scoreResults[0].finalScore ?? 0;
          score += (callScore - 50) * 0.5; // Ajustement basé sur le score de l'appel
        }
      }

      // Facteur 2: Montant de la facture
      const amount = parseFloat(String(invoice.amount));
      if (amount < 100) score += 10;
      else if (amount > 1000) score -= 10;
      else if (amount > 5000) score -= 20;

      // Facteur 3: Statut de la facture
      if (invoice.status === "accepted") score += 20;

      return Math.max(0, Math.min(100, score));
    } catch (error: unknown) {
      logger.error("[CommandValidationService] Failed to calculate validation score", { error, invoiceId });
      return 0;
    }
  }

  /**
   * Détermine le niveau de risque
   */
  private static determineRiskLevel(validationScore: number, amount: number): "low" | "medium" | "high" {
    if (validationScore >= 70 && amount < 1000) return "low";
    if (validationScore >= 50 && amount < 5000) return "medium";
    return "high";
  }

  /**
   * Détermine si une validation humaine est requise
   */
  private static requiresHumanReview(riskLevel: "low" | "medium" | "high", amount: number): boolean {
    // Validation humaine requise pour:
    // - Risque élevé
    // - Montant > 5000€
    // - Risque moyen + montant > 2000€
    if (riskLevel === "high") return true;
    if (amount > 5000) return true;
    if (riskLevel === "medium" && amount > 2000) return true;
    return false;
  }

  /**
   * Valide automatiquement une commande (IA)
   */
  static async validateAutomatically(invoiceId: number): Promise<{
    success: boolean;
    validationId?: number;
    requiresHumanReview: boolean;
    validationScore: number;
    riskLevel: string;
  }> {
    try {
      const db = getDbInstance();
      if (!db) {
        return { success: false, requiresHumanReview: true, validationScore: 0, riskLevel: "high" };
      }

      // Récupérer la facture
      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) {
        return { success: false, requiresHumanReview: true, validationScore: 0, riskLevel: "high" };
      }

      const invoice = invoiceResults[0];
      const amount = parseFloat(String(invoice.amount));

      // Calculer le score de validation
      const validationScore = await this.calculateValidationScore(invoiceId);
      const riskLevel = this.determineRiskLevel(validationScore, amount);
      const requiresHumanReview = this.requiresHumanReview(riskLevel, amount);

      // Créer la validation
      const validationData: InsertCommandValidation = {
        tenantId: invoice.tenantId,
        command: `VALIDATE_INVOICE_${invoiceId}`,
        invoiceId,
        
        validatedBy: "IA-Auto",
        validationScore,
        riskLevel,
        requiresHumanReview,
        status: requiresHumanReview ? "pending_review" : "approved",
        reason: requiresHumanReview 
          ? `Validation humaine requise (risque: ${riskLevel}, score: ${validationScore})`
          : `Validation automatique (risque: ${riskLevel}, score: ${validationScore})`,
      };

      const result = await db.insert(commandValidations).values(validationData);
      
      
      const validationId = result.insertId || result[0]?.insertId;

      // Enregistrer dans les métriques si lié à un appel
      if (invoice.callId && !requiresHumanReview) {
        await CallExecutionService.recordCommandValidation(invoice.callId);
      }

      await AuditService.log({
        tenantId: invoice.tenantId,
        userId: 0, // AI
        action: "IA_VALIDATION",
        resource: "invoice",
        resourceId: invoiceId,
        actorType: "ai",
        source: "SYSTEM",
        metadata: { validationScore, riskLevel, requiresHumanReview, validationId }
      });

      logger.info("[CommandValidationService] Automatic validation completed", {
        invoiceId,
        validationScore,
        riskLevel,
        requiresHumanReview,
      });

      return {
        success: true,
        validationId,
        requiresHumanReview,
        validationScore,
        riskLevel,
      };
    } catch (error: unknown) {
      logger.error("[CommandValidationService] Failed to validate automatically", { error, invoiceId });
      return { success: false, requiresHumanReview: true, validationScore: 0, riskLevel: "high" };
    }
  }

  /**
   * Valide manuellement une commande (Humain)
   */
  static async validateManually(
    invoiceId: number,
    userId: number,
    userName: string,
    approved: boolean,
    reason?: string
  ): Promise<boolean> {
    try {
      const db = getDbInstance();
      if (!db) return false;

      // Récupérer la facture
      const invoiceResults = await db
        .select()
        .from(customerInvoices)
        .where(eq(customerInvoices.id, invoiceId))
        .limit(1);

      if (invoiceResults.length === 0) return false;

      const invoice = invoiceResults[0];

      // Vérifier si une validation automatique existe
      const existingValidation = await db
        .select()
        .from(commandValidations)
        .where(eq((commandValidations as unknown).invoiceId, invoiceId))
        .limit(1);

      if (existingValidation.length > 0) {
        // Mettre à jour la validation existante
        await db
          .update(commandValidations)
          .set({
            
            validatedBy: `${userName} (Humain)`,
            validatedByUserId: userId,
            status: approved ? "approved" : "rejected",
            reason: reason || (approved ? "Approuvé manuellement" : "Rejeté manuellement"),
            updatedAt: new Date(),
          })
          .where(eq(commandValidations.id, existingValidation[0].id));
      } else {
        // Créer une nouvelle validation
        const validationData: InsertCommandValidation = {
          tenantId: invoice.tenantId,
          command: `VALIDATE_INVOICE_${invoiceId}`,
          invoiceId,
          
          validatedBy: `${userName} (Humain)`,
          validatedByUserId: userId,
          validationScore: approved ? 100 : 0,
          riskLevel: "low",
          requiresHumanReview: false,
          status: approved ? "approved" : "rejected",
          reason: reason || (approved ? "Approuvé manuellement" : "Rejeté manuellement"),
        };

        await db.insert(commandValidations).values(validationData);
      }

      // Enregistrer dans les métriques si approuvé et lié à un appel
      if (approved && invoice.callId) {
        await CallExecutionService.recordCommandValidation(invoice.callId);
      }

      await AuditService.log({
        tenantId: invoice.tenantId,
        userId,
        action: "IA_VALIDATION",
        resource: "invoice",
        resourceId: invoiceId,
        actorType: "human",
        source: "SYSTEM",
          metadata: { approved, reason, userName }
      });

      logger.info("[CommandValidationService] Manual validation completed", {
        invoiceId,
        userId,
        approved,
      });

      return true;
    } catch (error: unknown) {
      logger.error("[CommandValidationService] Failed to validate manually", { error, invoiceId });
      return false;
    }
  }

  /**
   * Récupère la validation d'une facture
   */
  static async getValidation(invoiceId: number) {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const results = await db
        .select()
        .from(commandValidations)
        .where(eq((commandValidations as unknown).invoiceId, invoiceId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error: unknown) {
      logger.error("[CommandValidationService] Failed to get validation", { error, invoiceId });
      return null;
    }
  }

  /**
   * Liste les validations en attente de revue humaine
   */
  static async listPendingReviews(tenantId: number, limit = 50, offset = 0) {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const results = await db
        .select()
        .from(commandValidations)
        .where(eq(commandValidations.tenantId, tenantId))
        .limit(limit)
        .offset(offset);

      // Filtrer ceux en attente de revue
      return results.filter((v: any) => v.status === "pending_review");
    } catch (error: unknown) {
      logger.error("[CommandValidationService] Failed to list pending reviews", { error, tenantId });
      return [];
    }
  }

  /**
   * Récupère les statistiques de validation
   */
  static async getStatistics(tenantId: number) {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const validations = await db
        .select()
        .from(commandValidations)
        .where(eq(commandValidations.tenantId, tenantId));

      const total = validations.length;
      const approved = validations.filter((v: any) => v.status === "approved").length;
      const rejected = validations.filter((v: any) => v.status === "rejected").length;
      const pending = validations.filter((v: any) => v.status === "pending_review").length;
      const autoApproved = validations.filter((v: any) => v.validatedBy === "IA-Auto" && v.status === "approved").length;
      const humanReviewed = validations.filter((v: any) => v.validatedBy?.includes("Humain")).length;

      const avgScore = validations.length > 0
        ? Math.round(validations.reduce((sum: number, v: any) => sum + (Number(v.validationScore) || 0), 0) / validations.length)
        : 0;

    return {
      total,
      approved,
      rejected,
      pending,
      autoApproved,
      humanReviewed,
      avgScore,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
      automationRate: total > 0 ? Math.round((autoApproved / total) * 100) : 0,
      riskDistribution: {
        low: validations.filter((v: any) => v.riskLevel === "low").length,
        medium: validations.filter((v: any) => v.riskLevel === "medium").length,
        high: validations.filter((v: any) => v.riskLevel === "high").length,
      }
    };
  } catch (error: unknown) {
      logger.error("[CommandValidationService] Failed to get statistics", { error, tenantId });
      return null;
    }
  }
}