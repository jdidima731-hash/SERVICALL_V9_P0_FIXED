/**
 * AI Lead Scoring Service
 * Moteur de scoring automatique pour les leads (0-100)
 * ✅ PHASE 3 — Dashboard Analytics Pro
 */

import { logger } from "../infrastructure/logger";
import { chatCompletionWithRetry } from "./openaiRetryService";
import { get as cacheGet, set as cacheSet } from "./cacheService.enhanced";
import { getDbInstance } from "../db";
import { eq, and } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

export interface LeadScoringFactors {
  interactionScore: number; // Basé sur le nombre d'interactions
  sentimentScore: number; // Basé sur le sentiment des appels
  emailResponseScore: number; // Basé sur les réponses aux emails
  crmActivityScore: number; // Basé sur l'activité CRM
  engagementScore: number; // Basé sur l'engagement global
}

export interface LeadScore {
  prospectId: number;
  score: number; // 0-100
  badge: "Froid" | "Tiède" | "Chaud";
  factors: LeadScoringFactors;
  timestamp: Date;
  reasoning: string;
}

/**
 * Service de scoring IA pour les leads
 */
export class AILeadScoringService {
  /**
   * Calcule le score d'un lead basé sur plusieurs facteurs
   */
  async calculateLeadScore(prospectId: number, tenantId: number): Promise<LeadScore> {
    try {
      // Vérifier le cache d'abord
      const cached = await cacheGet<number>(`lead_score:${prospectId}`);
      if (cached !== null) {
        logger.debug("[LeadScoring] Cache hit for prospect", { prospectId });
        return this.getLeadScoreDetails(prospectId, cached);
      }

      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      // Récupérer les données du prospect
      const prospectData = await db.select().from(schema.prospects).where(and(eq(schema.prospects.id, prospectId), eq(schema.prospects.tenantId, tenantId))).limit(1);
      const prospect = prospectData[0];
      
      if (!prospect) {
        throw new Error(`Prospect ${prospectId} not found`);
      }

      // Calculer les facteurs de scoring
      const factors = await this.calculateScoringFactors(prospectId, tenantId);

      // Calculer le score global (moyenne pondérée)
      const score = Math.round(
        factors.interactionScore * 0.25 +
          factors.sentimentScore * 0.25 +
          factors.emailResponseScore * 0.2 +
          factors.crmActivityScore * 0.2 +
          factors.engagementScore * 0.1
      );

      // Déterminer le badge
      const badge = this.getBadge(score);

      // Générer le reasoning via IA
      const reasoning = await this.generateReasoning(prospect, factors, score);

      // Mettre en cache le score
      await cacheSet(`lead_score:${prospectId}`, score, 1800);

      const result: LeadScore = {
        prospectId,
        score,
        badge,
        factors,
        timestamp: new Date(),
        reasoning,
      };

      logger.info("[LeadScoring] Lead score calculated", {
        prospectId,
        score,
        badge,
      });

      return result;
    } catch (error: any) {
      logger.error("[LeadScoring] Error calculating lead score", { prospectId, error });
      throw error;
    }
  }

  /**
   * Calcule les facteurs individuels de scoring
   */
  private async calculateScoringFactors(
    prospectId: number,
    tenantId: number
  ): Promise<LeadScoringFactors> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    // Interaction Score (nombre d'interactions)
    const interactions = await db
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.prospectId, prospectId), eq(schema.messages.tenantId, tenantId)));

    const interactionScore = Math.min(100, interactions.length * 10);

    // Sentiment Score (basé sur les appels)
    const calls = await db
      .select()
      .from(schema.calls)
      .where(and(eq(schema.calls.prospectId, prospectId), eq(schema.calls.tenantId, tenantId)));

    let sentimentScore = 50; // Score par défaut
    if (calls.length > 0) {
      const positiveCalls = calls.filter((c: any) => c.sentiment === "positive").length;
      sentimentScore = Math.round((positiveCalls / calls.length) * 100);
    }

    // Email Response Score
    const emailMessages = interactions.filter((m: any) => m.type === "email");
    const emailResponseScore =
      emailMessages.length > 0
        ? Math.min(100, (emailMessages.filter((m: any) => m.direction === "inbound").length / emailMessages.length) * 100)
        : 0;

    // CRM Activity Score (basé sur les mises à jour récentes)
    const recentActivity = interactions.filter((m: any) => {
      const daysSince = (Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 7; // Activité des 7 derniers jours
    });

    const crmActivityScore = Math.min(100, recentActivity.length * 15);

    // Engagement Score (combinaison de tous les facteurs)
    const engagementScore =
      (interactionScore + sentimentScore + emailResponseScore + crmActivityScore) / 4;

    return {
      interactionScore,
      sentimentScore,
      emailResponseScore,
      crmActivityScore,
      engagementScore: Math.round(engagementScore),
    };
  }

  /**
   * Détermine le badge basé sur le score
   */
  private getBadge(score: number): "Froid" | "Tiède" | "Chaud" {
    if (score >= 70) return "Chaud";
    if (score >= 40) return "Tiède";
    return "Froid";
  }

  /**
   * Génère un reasoning IA pour expliquer le score
   */
  private async generateReasoning(
    prospect: any,
    factors: LeadScoringFactors,
    score: number
  ): Promise<string> {
    try {
      const prompt = `Analyse ce lead et fournis un résumé court (1-2 phrases) expliquant le score de ${score}/100:
      
Prospect: ${prospect.firstName} ${prospect.lastName}
Facteurs:
- Interactions: ${factors.interactionScore}/100
- Sentiment: ${factors.sentimentScore}/100
- Réponses emails: ${factors.emailResponseScore}/100
- Activité CRM: ${factors.crmActivityScore}/100
- Engagement: ${factors.engagementScore}/100

Fournis un reasoning concis et actionnable.`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: prompt }],
        "gpt-4o-mini"
      );

      const reasoning = response.choices[0]?.message?.content || "Analyse en cours...";
      return reasoning.substring(0, 200); // Limiter à 200 caractères
    } catch (error: any) {
      logger.error("[LeadScoring] Error generating reasoning", { error });
      return "Score calculé basé sur les interactions et l'engagement.";
    }
  }

  /**
   * Récupère les détails du score d'un lead
   */
  private async getLeadScoreDetails(prospectId: number, score: number): Promise<LeadScore> {
    const badge = this.getBadge(score);
    return {
      prospectId,
      score,
      badge,
      factors: {
        interactionScore: 0,
        sentimentScore: 0,
        emailResponseScore: 0,
        crmActivityScore: 0,
        engagementScore: 0,
      },
      timestamp: new Date(),
      reasoning: "Score récupéré du cache.",
    };
  }

  /**
   * Recalcule les scores de tous les leads d'un tenant
   */
  async recalculateAllLeadScores(tenantId: number): Promise<LeadScore[]> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    try {
      const prospects = await db
        .select()
        .from(schema.prospects)
        .where(eq(schema.prospects.tenantId, tenantId));

      const scores: LeadScore[] = [];

      for (const prospect of prospects) {
        try {
          const score = await this.calculateLeadScore(prospect.id, tenantId);
          scores.push(score);
        } catch (error: any) {
          logger.error("[LeadScoring] Error calculating score for prospect", {
            prospectId: prospect.id,
            error,
          });
        }
      }

      logger.info("[LeadScoring] Recalculated scores for all leads", {
        tenantId,
        count: scores.length,
      });

      return scores;
    } catch (error: any) {
      logger.error("[LeadScoring] Error recalculating all lead scores", { tenantId, error });
      throw error;
    }
  }

  /**
   * Récupère les leads par badge
   */
  async getLeadsByBadge(
    tenantId: number,
    badge: "Froid" | "Tiède" | "Chaud"
  ): Promise<{ prospect: any; score: LeadScore }[]> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    try {
      const prospects = await db
        .select()
        .from(schema.prospects)
        .where(eq(schema.prospects.tenantId, tenantId));

      const results = [];

      for (const prospect of prospects) {
        try {
          const score = await this.calculateLeadScore(prospect.id, tenantId);
          if (score.badge === badge) {
            results.push({ prospect, score });
          }
        } catch (error: any) {
          logger.error("[LeadScoring] Error calculating score for prospect", {
            prospectId: prospect.id,
            error,
          });
        }
      }

      return results;
    } catch (error: any) {
      logger.error("[LeadScoring] Error getting leads by badge", { tenantId, badge, error });
      throw error;
    }
  }
}

/**
 * Instance singleton du service de scoring IA
 */
export const aiLeadScoringService = new AILeadScoringService();
