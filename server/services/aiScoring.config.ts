/**
 * Configuration du moteur de scoring IA
 * Définit les pondérations, les seuils et les règles de calcul.
 */

export type Sentiment = "positive" | "neutral" | "negative";
export type Urgency = "low" | "medium" | "high";

export interface ScoringWeights {
  sentiment: number;
  duration: number;
  objections: number;
  intentions: number;
  history: number;
  aiQuality: number;
}

export interface ScoringThresholds {
  critical: number;
  warning: number;
  good: number;
  excellent: number;
}

export const CALL_SCORING_CONFIG = {
  weights: {
    aiQuality: 0.6,    // Poids de l'analyse qualitative de l'IA
    sentiment: 0.2,    // Poids du sentiment détecté
    duration: 0.1,     // Poids de la durée (engagement)
    outcome: 0.1       // Poids du résultat (accord/actions)
  },
  thresholds: {
    critical: 30,
    warning: 50,
    good: 75,
    excellent: 90
  }
} as const;

export const LEAD_SCORING_CONFIG = {
  baseScore: 50,
  weights: {
    sentiment: {
      positive: 20,
      neutral: 0,
      negative: -25
    },
    objections: -5,    // Par objection
    intentions: 15,    // Par intention de haute valeur
    duration: {
      long: 10,        // > 5 min
      short: -10       // < 30 sec
    },
    history: 4,        // Par interaction passée (max 20)
  },
  highValueIntentions: ["achat", "devis", "rendez-vous", "prix", "commande", "intéressé"],
  thresholds: {
    cold: 30,
    warm: 60,
    hot: 85
  }
} as const;

export interface ScoreExplanation {
  factor: string;
  points: number;
  reason: string;
}

export interface FinalScore {
  score: number;
  level: string;
  explanations: ScoreExplanation[];
}
