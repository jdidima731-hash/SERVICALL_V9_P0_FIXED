/**
 * Agent Coaching Service - Coaching automatisé et feedback personnalisé
 * Analyse chaque appel et génère des recommandations pour améliorer la performance
 */

import { db } from '../db';
import { calls, coachingFeedback, agentPerformance } from '@db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { logger as loggingService } from "../infrastructure/logger";
import * as aiService from './aiService';
import { CallScoringService } from './callScoringService';
import { SentimentAnalysisService } from './sentimentAnalysisService';
// Interface locale pour les feedbacks lors des agrégations
interface CoachingFeedbackItem {
  overallScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  [key: string]: any;
}


// callScoringService instance not needed - CallScoringService uses static methods
// const callScoringService = new CallScoringService();
// SentimentAnalysisService requires callId as constructor argument - use static-like approach
const createSentimentService = (callId: string) => new SentimentAnalysisService(callId);

interface CallAnalysis {
  callId: number;
  agentId: number;
  duration: number;
  scriptAdherence: number; // 0-100
  objectionHandling: number; // 0-100
  customerSentiment: number; // 0-100
  effectiveness: number; // 0-100
  qualityScore: number; // 0-100
  keyMoments: {
    timestamp: number;
    type: 'positive' | 'negative' | 'critical';
    description: string;
  }[];
}

interface CoachingFeedback {
  id: string;
  callId: number;
  agentId: number;
  tenantId: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  specificFeedback: {
    category: string;
    score: number;
    feedback: string;
    examples: string[];
  }[];
  actionItems: string[];
  generatedAt: Date;
}

interface PerformanceMetrics {
  agentId: number;
  tenantId: number;
  period: { start: Date; end: Date };
  metrics: {
    totalCalls: number;
    averageScore: number;
    scriptAdherence: number;
    objectionHandling: number;
    customerSatisfaction: number;
    conversionRate: number;
    improvementRate: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  topStrengths: string[];
  areasForImprovement: string[];
}

// ✅ FIX — Classe exportée pour import direct dans twilioService (coaching post-appel automatique)
export class AgentCoachingService {
  /**
   * Analyse un appel et génère un feedback personnalisé
   */
  async analyzeCallAndGenerateFeedback(
    callId: number,
    tenantId: number
  ): Promise<CoachingFeedback> {
    try {
      // Récupérer les informations de l'appel
      const call = await db.query.calls.findFirst({
        where: and(eq(calls.id, callId), eq(calls.tenantId, tenantId))
      });

      if (!call) {
        throw new Error('Appel non trouvé');
      }

      // Analyser l'appel
      const analysis = await this.analyzeCall(call);

      // Générer le feedback avec IA
      const feedback = await this.generatePersonalizedFeedback(analysis, call);

      // Sauvegarder le feedback — champs alignés avec le schema Drizzle coachingFeedback
      await db.insert(coachingFeedback).values({
        tenantId: feedback.tenantId,
        agentId: feedback.agentId,
        callId: feedback.callId,
        coachId: feedback.agentId, // Utiliser l'agentId comme coachId par défaut si non spécifié
        feedback: JSON.stringify({
          overallScore: feedback.overallScore,
          recommendations: feedback.recommendations,
          specificFeedback: feedback.specificFeedback,
          actionItems: feedback.actionItems,
        }),
        rating: Math.min(5, Math.max(1, Math.round(feedback.overallScore / 20))), // 0-100 → 1-5
        strengths: feedback.strengths,
        improvements: feedback.weaknesses,
        metadata: {
          generatedAt: feedback.generatedAt,
        },
      });

      // Mettre à jour les métriques de performance de l'agent
      await this.updateAgentPerformanceMetrics(call.agentId!, tenantId as number);

      loggingService.info('Coaching: Feedback généré', {
        tenantId,
        callId,
        agentId: call.agentId!,
        overallScore: feedback.overallScore
      });

      return feedback;
    } catch (error: any) {
      loggingService.error('Coaching: Erreur lors de l\'analyse de l\'appel', {
        error,
        tenantId,
        callId
      });
      throw new Error('Impossible de générer le feedback de coaching');
    }
  }

  /**
   * Analyse détaillée d'un appel
   */
  private async analyzeCall(call: any): Promise<CallAnalysis> {
    try {
      // Récupérer le scoring de l'appel
      const scoring = await CallScoringService.scoreCall(call.id);

      // Analyser le sentiment
      const sentimentSvc = createSentimentService(String(call.id));
      const sentiment = await sentimentSvc.analyzeSentiment(
        call.transcription ?? ''
      );

      // Analyser l'adhérence au script (via transcription)
      const scriptAdherence = await this.analyzeScriptAdherence(call);

      // Analyser la gestion des objections
      const objectionHandling = await this.analyzeObjectionHandling(call);

      // Identifier les moments clés
      const keyMoments = await this.identifyKeyMoments(call);

      // Calculer l'efficacité globale
      const effectiveness = this.calculateEffectiveness({
        scriptAdherence,
        objectionHandling,
        sentiment: sentiment.score,
        outcome: call.outcome
      });

      return {
        callId: call.id,
        agentId: call.agentId!,
        duration: call.duration ?? 0,
        scriptAdherence,
        objectionHandling,
        customerSentiment: sentiment.score,
        effectiveness,
        qualityScore: scoring ? 100 : 0,
        keyMoments
      };
    } catch (error: any) {
      loggingService.error('Coaching: Erreur lors de l\'analyse de l\'appel', {
        error,
        callId: call.id
      });
      throw error;
    }
  }

  /**
   * Génère un feedback personnalisé avec IA
   */
  private async generatePersonalizedFeedback(
    analysis: CallAnalysis,
    call: any): Promise<CoachingFeedback> {
    try {
      // Construire le prompt pour l'IA
      const prompt = `
Tu es un coach commercial expert. Analyse cet appel et génère un feedback constructif et personnalisé.

Métriques de l'appel:
- Score qualité: ${analysis.qualityScore}/100
- Adhérence au script: ${analysis.scriptAdherence}/100
- Gestion des objections: ${analysis.objectionHandling}/100
- Sentiment client: ${analysis.customerSentiment}/100
- Efficacité: ${analysis.effectiveness}/100
- Durée: ${analysis.duration}s
- Résultat: ${call.outcome}

Moments clés:
${analysis.keyMoments.map(m => `- [${m.timestamp}s] ${m.type}: ${m.description}`).join('\n')}

Génère un feedback JSON structuré avec:
1. strengths: 3-5 points forts spécifiques
2. weaknesses: 2-4 points à améliorer
3. recommendations: 3-5 recommandations concrètes et actionnables
4. specificFeedback: analyse détaillée par catégorie (script, objections, sentiment, closing)
5. actionItems: 3 actions prioritaires à mettre en œuvre

Sois constructif, précis et encourage l'amélioration continue.
`;

      const aiResponse = await aiService.generateCompletion({
        prompt,
        systemPrompt: 'Tu es un coach commercial expert spécialisé dans l\'amélioration des performances des agents.',
        temperature: 0.7,
      });
      // Parser la réponse IA
      let feedbackData: any;
      try {
        feedbackData = JSON.parse(aiResponse);
      } catch {
        // Fallback si l'IA ne retourne pas du JSON valide
        feedbackData = {
          strengths: ['Appel complété avec succès'],
          weaknesses: ['Analyse détaillée non disponible'],
          recommendations: ['Continuer à pratiquer et améliorer'],
          specificFeedback: [],
          actionItems: ['Revoir l\'enregistrement de l\'appel']
        };
      }

      const feedback: CoachingFeedback = {
        id: crypto.randomUUID(),
        callId: analysis.callId,
        agentId: analysis.agentId,
        tenantId: call.tenantId,
        overallScore: Math.round(
          (analysis.qualityScore +
            analysis.scriptAdherence +
            analysis.objectionHandling +
            analysis.effectiveness) /
            4
        ),
        strengths: feedbackData.strengths || [],
        weaknesses: feedbackData.weaknesses || [],
        recommendations: feedbackData.recommendations || [],
        specificFeedback: feedbackData.specificFeedback || [],
        actionItems: feedbackData.actionItems || [],
        generatedAt: new Date()
      };

      return feedback;
    } catch (error: any) {
      loggingService.error('Coaching: Erreur lors de la génération du feedback', {
        error,
        callId: analysis.callId
      });
      throw error;
    }
  }

  /**
   * Analyse l'adhérence au script
   */
  private async analyzeScriptAdherence(call: any): Promise<number> {
    // Analyse fine transcription vs script à enrichir dans une itération dédiée
    // Pour l'instant, retourner un score basique
    if (call.transcription && call.script) {
      // Comparer la transcription avec le script attendu
      // Utiliser NLP pour mesurer la similarité
      return Math.floor(Math.random() * 30) + 70; // 70-100 (temporaire)
    }
    return 75; // Score par défaut
  }

  /**
   * Analyse la gestion des objections
   */
  private async analyzeObjectionHandling(call: any): Promise<number> {
    // Détection avancée des objections à enrichir dans une itération dédiée
    if (call.transcription) {
      const objectionKeywords = [
        'trop cher',
        'pas intéressé',
        'pas le temps',
        'déjà un fournisseur',
        'rappeler plus tard'
      ];

      const transcription = call.transcription.toLowerCase();
      const hasObjections = objectionKeywords.some(keyword =>
        transcription.includes(keyword)
      );

      if (hasObjections) {
        // Analyser si l'agent a bien géré l'objection
        return Math.floor(Math.random() * 40) + 60; // 60-100
      }
    }
    return 80; // Score par défaut
  }

  /**
   * Identifie les moments clés de l'appel
   */
  private async identifyKeyMoments(call: any): Promise<
    Array<{
      timestamp: number;
      type: 'positive' | 'negative' | 'critical';
      description: string;
    }>
  > {
    const moments: Array<{
      timestamp: number;
      type: 'positive' | 'negative' | 'critical';
      description: string;
    }> = [];

    // Analyse horodatée avancée à enrichir dans une itération dédiée
    // Pour l'instant, retourner des exemples
    if (call.outcome === 'success') {
      moments.push({
        timestamp: Math.floor(call.duration * 0.8),
        type: 'positive',
        description: 'Closing réussi - Client accepte la proposition'
      });
    }

    return moments;
  }

  /**
   * Calcule l'efficacité globale
   */
  private calculateEffectiveness(params: {
    scriptAdherence: number;
    objectionHandling: number;
    sentiment: number;
    outcome: string;
  }): number {
    const { scriptAdherence, objectionHandling, sentiment, outcome } = params;

    let baseScore = (scriptAdherence + objectionHandling + sentiment) / 3;

    // Bonus/malus selon le résultat
    if (outcome === 'success' || outcome === 'converted') {
      baseScore *= 1.2;
    } else if (outcome === 'failed' || outcome === 'rejected') {
      baseScore *= 0.8;
    }

    return Math.min(100, Math.max(0, Math.round(baseScore)));
  }

  /**
   * Met à jour les métriques de performance de l'agent
   */
  private async updateAgentPerformanceMetrics(
    agentId: number,
    tenantId: number
  ): Promise<void> {
    try {
      // Récupérer tous les feedbacks de l'agent sur les 30 derniers jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const feedbacks = await db.query.coachingFeedback.findMany({
        where: and(
          eq(coachingFeedback.agentId, agentId),
          eq(coachingFeedback.tenantId, tenantId),
          gte(coachingFeedback.createdAt, thirtyDaysAgo)
        ),
        orderBy: [desc(coachingFeedback.createdAt)]
      });

      if (feedbacks.length === 0) return;

      // Calculer les moyennes
      const averageScore =
        (feedbacks as CoachingFeedbackItem[]).reduce((sum: number, f: CoachingFeedbackItem) => sum + (f.overallScore ?? 0), 0) / feedbacks.length;

      // Calculer la tendance (comparer première moitié vs deuxième moitié)
      const midPoint = Math.floor(feedbacks.length / 2);
      const recentAvg = midPoint > 0 ?
        feedbacks.slice(0, midPoint).reduce((sum: number, f: any) => sum + (f.overallScore ?? 0), 0) / midPoint : averageScore;
      const olderAvg = (feedbacks.length - midPoint) > 0 ?
        feedbacks.slice(midPoint).reduce((sum: number, f: any) => sum + (f.overallScore ?? 0), 0) /
        (feedbacks.length - midPoint) : averageScore;

      const trend: 'improving' | 'stable' | 'declining' =
        recentAvg > olderAvg + 5
          ? 'improving'
          : recentAvg < olderAvg - 5
          ? 'declining'
          : 'stable';

      // Identifier les forces et faiblesses récurrentes
      const allStrengths = (feedbacks as CoachingFeedbackItem[]).flatMap((f: CoachingFeedbackItem) => f.strengths ?? []);
      const allWeaknesses = (feedbacks as CoachingFeedbackItem[]).flatMap((f: CoachingFeedbackItem) => f.weaknesses ?? []);

      const topStrengths = this.getMostFrequent(allStrengths, 3);
      const areasForImprovement = this.getMostFrequent(allWeaknesses, 3);

      // Mettre à jour ou créer l'enregistrement de performance
      const performanceData = {
        agentId,
        tenantId,
        totalCalls: feedbacks.length,
        averageScore: Math.round(averageScore),
        trend,
        topStrengths,
        areasForImprovement,
        lastUpdated: new Date()
      };

      await db
        .insert(agentPerformance)
        
        .values(performanceData)
        .onConflictDoUpdate({
          target: [agentPerformance.agentId, agentPerformance.tenantId],
          set: performanceData as unknown
        });

      loggingService.info('Coaching: Métriques de performance mises à jour', {
        tenantId,
        agentId,
        averageScore: Math.round(averageScore),
        trend
      });
    } catch (error: any) {
      loggingService.error('Coaching: Erreur lors de la mise à jour des métriques', {
        error,
        tenantId,
        agentId
      });
    }
  }

  /**
   * Récupère les métriques de performance d'un agent
   */
  async getAgentPerformanceMetrics(
    agentId: number,
    tenantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics> {
    try {
      // Récupérer tous les feedbacks de la période
      const feedbacks = await db.query.coachingFeedback.findMany({
        where: and(
          eq(coachingFeedback.agentId, agentId),
          eq(coachingFeedback.tenantId, tenantId),
          gte(coachingFeedback.createdAt, startDate)
        ),
        orderBy: [desc(coachingFeedback.createdAt)]
      });

      // Récupérer les appels de la période
      const agentCalls = await db.query.calls.findMany({
        where: and(
          eq(calls.agentId, agentId),
          eq(calls.tenantId, tenantId),
          gte(calls.createdAt, startDate)
        )
      });

      const totalCalls = agentCalls.length;
      const successfulCalls = agentCalls.filter(
        (c: CoachingFeedbackItem) => c['outcome'] === 'success' || c['outcome'] === 'converted'
      ).length;
      const conversionRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

      const averageScore =
        feedbacks.length > 0
          ? (feedbacks as CoachingFeedbackItem[]).reduce((sum: number, f: CoachingFeedbackItem) => sum + (f.overallScore ?? 0), 0) / feedbacks.length
          : 0;

      // Calculer la tendance
      const midPoint = Math.floor(feedbacks.length / 2);
      let trend: 'improving' | 'stable' | 'declining' = 'stable';

      if (feedbacks.length >= 4) {
        const recentAvg =
          feedbacks.slice(0, midPoint).reduce((sum: number, f: any) => sum + (f.overallScore ?? 0), 0) / midPoint;
        const olderAvg =
          feedbacks.slice(midPoint).reduce((sum: number, f: any) => sum + (f.overallScore ?? 0), 0) /
          (feedbacks.length - midPoint);

        trend =
          recentAvg > olderAvg + 5
            ? 'improving'
            : recentAvg < olderAvg - 5
            ? 'declining'
            : 'stable';
      }

      const allStrengths = (feedbacks as CoachingFeedbackItem[]).flatMap((f: CoachingFeedbackItem) => f.strengths ?? []);
      const allWeaknesses = (feedbacks as CoachingFeedbackItem[]).flatMap((f: CoachingFeedbackItem) => f.weaknesses ?? []);

      return {
        agentId,
        tenantId,
        period: { start: startDate, end: endDate },
        metrics: {
          totalCalls,
          averageScore: Math.round(averageScore),
          scriptAdherence: 0, // À calculer depuis les analyses
          objectionHandling: 0, // À calculer depuis les analyses
          customerSatisfaction: 0, // À calculer depuis les sentiments
          conversionRate: Math.round(conversionRate),
          improvementRate: 0 // À calculer
        },
        trend,
        topStrengths: this.getMostFrequent(allStrengths, 5),
        areasForImprovement: this.getMostFrequent(allWeaknesses, 5)
      };
    } catch (error: any) {
      loggingService.error('Coaching: Erreur lors de la récupération des métriques', {
        error,
        tenantId,
        agentId
      });
      throw new Error('Impossible de récupérer les métriques de performance');
    }
  }

  /**
   * Récupère les éléments les plus fréquents d'un tableau
   */
  private getMostFrequent(items: string[], limit: number): string[] {
    const frequency = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }

  /**
   * Récupère le feedback d'un appel spécifique
   */
  async getCallFeedback(callId: number, tenantId: number): Promise<CoachingFeedback | null> {
    try {
      const feedback = await db.query.coachingFeedback.findFirst({
        where: and(
          eq(coachingFeedback.callId, callId),
          eq(coachingFeedback.tenantId, tenantId)
        )
      });

      return feedback as unknown as CoachingFeedback | null;
    } catch (error: any) {
      loggingService.error('Coaching: Erreur lors de la récupération du feedback', {
        error,
        tenantId,
        callId
      });
      return null;
    }
  }
}

export const agentCoachingService = new AgentCoachingService();