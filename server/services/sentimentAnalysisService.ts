import { AI_MODEL } from '../_core/aiModels';
import { logger } from "../infrastructure/logger";
import { invokeLLM } from '../_core/llm';

/**
 * Sentiment Analysis Service
 * Real-time emotion detection from transcribed text
 * Detects: anger, stress, frustration, satisfaction, neutral
 */

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'angry' | 'frustrated' | 'stressed';
  score: number; // -1 to 1 (negative to positive)
  confidence: number; // 0 to 1
  emotions: {
    anger: number;
    frustration: number;
    stress: number;
    satisfaction: number;
    neutral: number;
  };
  shouldEscalate: boolean;
  escalationReason?: string;
}

export interface SentimentThresholds {
  angerThreshold: number;
  frustrationThreshold: number;
  stressThreshold: number;
  escalationThreshold: number;
}

export class SentimentAnalysisService {
  private callId: string;
  private sentimentHistory: SentimentResult[] = [];
  private thresholds: SentimentThresholds;

  // ✅ BLOC 1 FIX (TS2554) : tenantId requis par invokeLLM(tenantId, params)
  private tenantId: number;

  constructor(
    callId: string,
    thresholds: Partial<SentimentThresholds> = {},
    tenantId: number = 1
  ) {
    this.callId = callId;
    this.tenantId = tenantId;
    this.thresholds = {
      angerThreshold: 0.7,
      frustrationThreshold: 0.7,
      stressThreshold: 0.7,
      escalationThreshold: 0.75,
      ...thresholds,
    };

    logger.info('[Sentiment Analysis] Service initialized', {
      callId,
      thresholds: this.thresholds,
    });
  }

  /**
   * Analyze sentiment from transcribed text
   */
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const startTime = Date.now();

    try {
      logger.info('[Sentiment Analysis] Analyzing text', {
        callId: this.callId,
        text: text.substring(0, 100),
      });

      // Use LLM for sentiment analysis with structured output
      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(this.tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          {
            role: 'system',
            content: `Tu es un expert en analyse de sentiment pour les conversations téléphoniques.
Analyse le texte fourni et identifie les émotions présentes.

Retourne un JSON avec cette structure exacte:
{
  "sentiment": "positive" | "neutral" | "negative" | "angry" | "frustrated" | "stressed",
  "score": -1 à 1 (négatif à positif),
  "confidence": 0 à 1,
  "emotions": {
    "anger": 0 à 1,
    "frustration": 0 à 1,
    "stress": 0 à 1,
    "satisfaction": 0 à 1,
    "neutral": 0 à 1
  },
  "reasoning": "Explication courte de l'analyse"
}

Indicateurs d'émotions négatives:
- Colère: insultes, ton agressif, menaces, exigences
- Frustration: répétitions, "toujours", "jamais", soupirs
- Stress: urgence, anxiété, inquiétude
- Satisfaction: remerciements, compliments, accord
- Neutre: questions factuelles, informations

Sois précis et objectif.` as unknown,
          },
          {
            role: 'user',
            content: `Analyse ce texte: "${text}"` as unknown,
          },
        ],
        temperature: 0.3,
      });

      const content = (response as unknown).choices?.[0]?.message?.content as string;
      if (!content) {
        throw new Error('No content in LLM response');
      }
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('[Sentiment Analysis] No JSON found in response', { content: content.substring(0, 200) });
        throw new Error('Invalid JSON response from LLM');
      }

      let analysis;
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.error('[Sentiment Analysis] JSON parse error', { error: parseError, json: jsonMatch[0] });
        throw new Error('Failed to parse JSON response');
      }

      // Determine if escalation is needed
      const shouldEscalate = this.shouldEscalate(analysis.emotions);
      const escalationReason = shouldEscalate 
        ? this.getEscalationReason(analysis.emotions)
        : undefined;

      const result: SentimentResult = {
        sentiment: analysis.sentiment,
        score: analysis.score,
        confidence: analysis.confidence,
        emotions: analysis.emotions,
        shouldEscalate,
        escalationReason,
      };

      // Add to history
      this.sentimentHistory.push(result);

      const latency = Date.now() - startTime;

      logger.info('[Sentiment Analysis] Analysis completed', {
        callId: this.callId,
        result,
        latency,
      });

      // Log escalation alert
      if (shouldEscalate) {
        logger.warn('[Sentiment Analysis] ESCALATION RECOMMENDED', {
          callId: this.callId,
          reason: escalationReason,
          emotions: analysis.emotions,
        });
      }

      return result;

    } catch (error: any) {
      logger.error('[Sentiment Analysis] Error analyzing sentiment', {
        callId: this.callId,
        error,
      });

      // Return neutral sentiment on error
      return {
        sentiment: 'neutral',
        score: 0,
        confidence: 0,
        emotions: {
          anger: 0,
          frustration: 0,
          stress: 0,
          satisfaction: 0,
          neutral: 1,
        },
        shouldEscalate: false,
      };
    }
  }

  /**
   * Determine if escalation to human agent is needed
   */
  private shouldEscalate(emotions: SentimentResult['emotions']): boolean {
    // Check individual emotion thresholds
    if (emotions.anger >= this.thresholds.angerThreshold) {
      return true;
    }

    if (emotions.frustration >= this.thresholds.frustrationThreshold) {
      return true;
    }

    if (emotions.stress >= this.thresholds.stressThreshold) {
      return true;
    }

    // Check combined negative emotions
    const negativeScore = (emotions.anger + emotions.frustration + emotions.stress) / 3;
    if (negativeScore >= this.thresholds.escalationThreshold) {
      return true;
    }

    // Check trend: if last 3 interactions are increasingly negative
    if (this.sentimentHistory.length >= 3) {
      const recent = this.sentimentHistory.slice(-3);
      const isNegativeTrend = recent.every((r, i) => {
        if (i === 0) return true;
        return r.score <= (recent[i - 1]?.score ?? 0);
      });

      if (isNegativeTrend && (recent[recent.length - 1]?.score ?? 0) < -0.3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get escalation reason based on emotions
   */
  private getEscalationReason(emotions: SentimentResult['emotions']): string {
    const reasons: string[] = [];

    if (emotions.anger >= this.thresholds.angerThreshold) {
      reasons.push(`Colère détectée (${(emotions.anger * 100).toFixed(0)}%)`);
    }

    if (emotions.frustration >= this.thresholds.frustrationThreshold) {
      reasons.push(`Frustration élevée (${(emotions.frustration * 100).toFixed(0)}%)`);
    }

    if (emotions.stress >= this.thresholds.stressThreshold) {
      reasons.push(`Stress important (${(emotions.stress * 100).toFixed(0)}%)`);
    }

    if (reasons.length === 0) {
      reasons.push('Tendance négative persistante');
    }

    return reasons.join(', ');
  }

  /**
   * Get sentiment trend over time
   */
  getSentimentTrend(): {
    averageScore: number;
    trend: 'improving' | 'stable' | 'declining';
    escalationCount: number;
  } {
    if (this.sentimentHistory.length === 0) {
      return {
        averageScore: 0,
        trend: 'stable',
        escalationCount: 0,
      };
    }

    const averageScore = this.sentimentHistory.reduce((sum, r) => sum + r.score, 0) 
      / this.sentimentHistory.length;

    const escalationCount = this.sentimentHistory.filter(r => r.shouldEscalate).length;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (this.sentimentHistory.length >= 3) {
      const firstHalf = this.sentimentHistory.slice(0, Math.floor(this.sentimentHistory.length / 2));
      const secondHalf = this.sentimentHistory.slice(Math.floor(this.sentimentHistory.length / 2));

      const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length;

      if (secondAvg > firstAvg + 0.1) {
        trend = 'improving';
      } else if (secondAvg < firstAvg - 0.1) {
        trend = 'declining';
      }
    }

    return {
      averageScore,
      trend,
      escalationCount,
    };
  }

  /**
   * Get sentiment history
   */
  getHistory(): SentimentResult[] {
    return [...this.sentimentHistory];
  }

  /**
   * Get summary for logging
   */
  getSummary() {
    const trend = this.getSentimentTrend();
    
    return {
      callId: this.callId,
      analysisCount: this.sentimentHistory.length,
      averageScore: trend.averageScore.toFixed(2),
      trend: trend.trend,
      escalationCount: trend.escalationCount,
      lastSentiment: this.sentimentHistory.length > 0 
        ? this.sentimentHistory[this.sentimentHistory.length - 1]?.sentiment ?? 'none'
        : 'none',
    };
  }
}

/**
 * Quick sentiment analysis without full service initialization
 * Useful for one-off analysis
 */
export async function quickSentimentAnalysis(text: string): Promise<SentimentResult> {
  const service = new SentimentAnalysisService('quick-analysis');
  return service.analyzeSentiment(text);
}
