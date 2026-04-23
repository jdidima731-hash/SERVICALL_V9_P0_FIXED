/**
 * Scoring Service - Calcul du score prospect basé sur des données réelles
 * [CORRIGÉ - FINAL] Implémentation réelle, déterministe et testable.
 */

import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { prospects, calls } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export interface ScoringRules {
  hasEmail: number;
  hasPhone: number;
  hasCompany: number;
  urgencyHigh: number;
  urgencyMedium: number;
  callCountWeight: number;
  sentimentPositive: number;
  sentimentNegative: number;
}

export interface ProspectScoreResult {
  score: number;
  qualification: "HOT" | "WARM" | "COLD";
  details: {
    profileScore: number;
    interactionScore: number;
    callCount: number;
    lastSentiment?: string;
    lastUrgency?: string;
  };
}

const DEFAULT_RULES: ScoringRules = {
  hasEmail: 15,
  hasPhone: 10,
  hasCompany: 10,
  urgencyHigh: 40,
  urgencyMedium: 20,
  callCountWeight: 5,
  sentimentPositive: 20,
  sentimentNegative: -10,
};

/**
 * Fonction principale de calcul de score pour un prospect
 * [CORRIGÉ - FINAL] Utilise les données réelles de la DB
 */
export async function calculateLeadScore(prospectId: number): Promise<ProspectScoreResult> {
  const db = getDbInstance();
  if (!db) {
    throw new Error("Database connection not available for scoring");
  }

  // 1. Récupérer le prospect
  const prospectResults = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  if (prospectResults.length === 0) {
    throw new Error(`Prospect with ID ${prospectId} not found`);
  }

  const prospect = prospectResults[0];

  // 2. Récupérer les appels associés
  const prospectCalls = await db
    .select()
    .from(calls)
    .where(eq(calls.prospectId, prospectId))
    .orderBy(desc(calls.createdAt));

  // 3. Calculer le score
  return ScoringService.calculate(prospect, prospectCalls);
}

export class ScoringService {
  /**
   * Logique de calcul pure et déterministe
   */
  static calculate(prospect: any, callHistory: Array<Record<string, unknown>> = [], rules: ScoringRules = DEFAULT_RULES): ProspectScoreResult {
    let profileScore = 0;
    let interactionScore = 0;

    // --- A. Score de Profil (Max 35) ---
    if (prospect.email) profileScore += rules.hasEmail;
    if (prospect.phone) profileScore += rules.hasPhone;
    if (prospect.company) profileScore += rules.hasCompany;

    // --- B. Score d'Interaction (Max 65) ---
    if (callHistory.length > 0) {
      // Bonus volume (Max 20)
      interactionScore += Math.min(callHistory.length * rules.callCountWeight, 20);

      // Analyse du dernier appel (Le plus récent car trié par desc)
      const lastCall = callHistory[0] as unknown;
      
      // Urgence (Max 40)
      if (lastCall?.urgency === "high") interactionScore += rules.urgencyHigh;
      else if (lastCall?.urgency === "medium") interactionScore += rules.urgencyMedium;

      // Sentiment (Max 20, Min -10)
      if (lastCall?.sentiment === "positive") interactionScore += rules.sentimentPositive;
      else if (lastCall?.sentiment === "negative") interactionScore += rules.sentimentNegative;
    }

    // --- C. Synthèse ---
    const totalScore = Math.max(0, Math.min(100, profileScore + interactionScore));
    const qualification = this.getCategory(totalScore);

    const result: ProspectScoreResult = {
      score: totalScore,
      qualification,
      details: {
        profileScore,
        interactionScore,
        callCount: callHistory.length,
        lastSentiment: (callHistory[0] as unknown)?.sentiment as string,
        lastUrgency: (callHistory[0] as unknown)?.urgency as string
      }
    };

    logger.debug(`[Scoring] Calculated real score for prospect ${prospect.id}: ${totalScore}`, {
      prospectId: prospect.id,
      qualification,
      callCount: callHistory.length
    });

    return result;
  }

  /**
   * Déterminer la catégorie du prospect
   */
  static getCategory(score: number): "HOT" | "WARM" | "COLD" {
    if (score >= 70) return "HOT";
    if (score >= 30) return "WARM";
    return "COLD";
  }

  /**
   * Calcule le score d'un prospect (alias pour calculate)
   */
  static async calculateProspectScore(prospectId: number): Promise<ProspectScoreResult> {
    return calculateLeadScore(prospectId);
  }

  /**
   * Récupère la catégorie d'un prospect (alias pour getCategory)
   */
  static getProspectCategory(score: number): "HOT" | "WARM" | "COLD" {
    return this.getCategory(score);
  }
}
