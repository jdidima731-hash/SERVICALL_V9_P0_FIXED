import { 
  CALL_SCORING_CONFIG, 
  LEAD_SCORING_CONFIG, 
  FinalScore, 
  ScoreExplanation,
  Sentiment
} from "./aiScoring.config";

/**
 * Moteur de Scoring IA Centralisé
 * Sépare la logique de calcul de la logique LLM.
 */
export class AIScoringService {
  
  /**
   * Calcule le score de qualité d'un appel
   */
  static calculateCallScore(params: {
    aiQualityScore: number;
    sentiment: Sentiment;
    durationSeconds: number;
    hasActionItems: boolean;
  }): FinalScore {
    const explanations: ScoreExplanation[] = [];
    const { weights, thresholds } = CALL_SCORING_CONFIG;

    // 1. Base IA Quality
    const aiPoints = params.aiQualityScore * weights.aiQuality;
    explanations.push({
      factor: "Qualité IA",
      points: aiPoints,
      reason: `Analyse qualitative de l'IA (Base: ${params.aiQualityScore}/100)`
    });

    // 2. Sentiment
    let sentimentPoints = 0;
    if (params.sentiment === "positive") sentimentPoints = 100 * weights.sentiment;
    else if (params.sentiment === "neutral") sentimentPoints = 50 * weights.sentiment;
    else sentimentPoints = 0;
    
    explanations.push({
      factor: "Sentiment",
      points: sentimentPoints,
      reason: `Sentiment détecté: ${params.sentiment}`
    });

    // 3. Durée
    let durationPoints = 0;
    if (params.durationSeconds > 180) durationPoints = 100 * weights.duration;
    else if (params.durationSeconds > 60) durationPoints = 60 * weights.duration;
    else if (params.durationSeconds > 30) durationPoints = 30 * weights.duration;
    
    explanations.push({
      factor: "Engagement",
      points: durationPoints,
      reason: `Durée de l'appel: ${params.durationSeconds}s`
    });

    // 4. Résultat (Action Items)
    const outcomePoints = params.hasActionItems ? (100 * weights.outcome) : (30 * weights.outcome);
    explanations.push({
      factor: "Résultat",
      points: outcomePoints,
      reason: params.hasActionItems ? "Actions concrètes identifiées" : "Aucune action identifiée"
    });

    const totalScore = Math.round(aiPoints + sentimentPoints + durationPoints + outcomePoints);
    
    let level = "Inconnu";
    if (totalScore >= thresholds.excellent) level = "Excellent";
    else if (totalScore >= thresholds.good) level = "Bon";
    else if (totalScore >= thresholds.warning) level = "Moyen";
    else level = "Critique";

    return {
      score: totalScore,
      level,
      explanations
    };
  }

  /**
   * Calcule le score de potentiel d'un prospect (Lead Scoring)
   */
  static calculateLeadScore(params: {
    sentiment: Sentiment;
    objectionsCount: number;
    intentions: string[];
    durationSeconds: number;
    historyCount: number;
  }): FinalScore {
    const explanations: ScoreExplanation[] = [];
    const config = LEAD_SCORING_CONFIG;
    let score = config.baseScore;

    explanations.push({
      factor: "Base",
      points: config.baseScore,
      reason: "Score de base initial"
    });

    // 1. Sentiment
    const sentimentBonus = (config.weights.sentiment as unknown)[params.sentiment];
    score += sentimentBonus;
    explanations.push({
      factor: "Sentiment",
      points: sentimentBonus,
      reason: `Impact du sentiment ${params.sentiment}`
    });

    // 2. Objections
    const objectionsPenalty = params.objectionsCount * config.weights.objections;
    score += objectionsPenalty;
    explanations.push({
      factor: "Objections",
      points: objectionsPenalty,
      reason: `${params.objectionsCount} objection(s) détectée(s)`
    });

    // 3. Intentions
    let intentionsBonus = 0;
    params.intentions.forEach(intent => {
      if ((config.highValueIntentions as readonly string[]).includes(intent.toLowerCase())) {
        intentionsBonus += config.weights.intentions;
      }
    });
    score += intentionsBonus;
    if (intentionsBonus > 0) {
      explanations.push({
        factor: "Intentions",
        points: intentionsBonus,
        reason: "Intentions d'achat ou d'intérêt détectées"
      });
    }

    // 4. Durée
    let durationImpact = 0;
    if (params.durationSeconds > 300) durationImpact = config.weights.duration.long;
    else if (params.durationSeconds < 30) durationImpact = config.weights.duration.short;
    score += durationImpact;
    if (durationImpact !== 0) {
      explanations.push({
        factor: "Engagement",
        points: durationImpact,
        reason: params.durationSeconds > 300 ? "Appel long et engagé" : "Appel trop court"
      });
    }

    // 5. Historique
    const historyBonus = Math.min(20, params.historyCount * config.weights.history);
    score += historyBonus;
    explanations.push({
      factor: "Historique",
      points: historyBonus,
      reason: `Fidélité: ${params.historyCount} interaction(s) passée(s)`
    });

    const finalScore = Math.min(100, Math.max(0, score));
    
    let level = "Froid";
    if (finalScore >= config.thresholds.hot) level = "Chaud (Hot)";
    else if (finalScore >= config.thresholds.warm) level = "Tiède (Warm)";
    else level = "Froid (Cold)";

    return {
      score: finalScore,
      level,
      explanations
    };
  }
}
