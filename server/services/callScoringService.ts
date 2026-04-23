import { eq } from "drizzle-orm";
import { getDbInstance } from "../db";
import { callScoring, InsertCallScoring, calls, CallScoring } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";
import { analyzeCallQuality, generateCallSummary, extractActionItems } from "./aiService";
import { triggerCallCompletedWorkflow } from "./workflowService";
import { AIScoringService } from "./aiScoring.service";
import { Sentiment } from "./aiScoring.config";

/**
 * Service de scoring des appels (0-100)
 * Centralise le scoring via le moteur AIScoringService pour une transparence totale.
 */

export class CallScoringService {
  /**
   * Analyse la durée de l'appel et retourne un score (0-30)
   * @deprecated Utiliser AIScoringService pour une logique centralisée
   */
  static analyzeCallDuration(durationSeconds: number): number {
    if (durationSeconds < 30) return 0;
    if (durationSeconds < 60) return 10;
    if (durationSeconds < 180) return 20;
    return 30;
  }

  /**
   * Score un appel complet en utilisant l'IA
   */
  static async scoreCall(callId: number): Promise<boolean> {
    const startTime = Date.now();
    try {
      const db = getDbInstance();
      if (!db) {
        logger.error("[CallScoringService] Database not available");
        return false;
      }

      // 1. Récupérer les données de l'appel
      const callResults = await db
        .select()
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (callResults.length === 0) {
        logger.error("[CallScoringService] Call not found", { callId });
        return false;
      }

      const call = callResults[0];
      const transcription = call.transcription ?? "";
      const duration = call.duration ?? 0;
      const tenantId = call.tenantId;

      if (!transcription) {
        logger.warn("[CallScoringService] No transcription available for scoring", { callId });
        return false;
      }

      logger.info("[CallScoringService] Starting AI-powered scoring", { callId, tenantId });

      // 2. Analyse IA en parallèle
      const [aiQuality, aiSummary, aiActions] = await Promise.all([
        analyzeCallQuality(transcription),
        generateCallSummary(transcription, {
          duration,
          callReason: "Scoring automatique",
          prospectName: "Client"
        }),
        extractActionItems(transcription)
      ]);

      // 3. Calcul du score final via le moteur de scoring explicite
      const scoringResult = AIScoringService.calculateCallScore({
        aiQualityScore: aiQuality.qualityScore,
        sentiment: aiQuality.sentiment as Sentiment,
        durationSeconds: duration,
        hasActionItems: aiActions.length > 0
      });

      const finalScore = scoringResult.score;

      // 4. Préparer les données de scoring avec explications
      const scoringData: InsertCallScoring = {
        callId,
        tenantId,
        
        overallScore: String(finalScore / 100),
        sentimentScore: String((scoringResult.explanations.find((e: any) => e.factor === "Sentiment")?.points ?? 0) / 100),
        feedback: aiQuality.sentiment,
        metadata: {
          aiQuality: aiQuality.feedback,
          level: scoringResult.level,
          explanations: scoringResult.explanations
        },
      };

      // 5. Mettre à jour l'appel avec le résumé et le score
      await db
        .update(calls)
        .set({
          summary: aiSummary,
          qualityScore: String(finalScore),
          sentiment: aiQuality.sentiment,
          updatedAt: new Date(),
        })
        .where(eq(calls.id, callId));

      // 6. Enregistrer ou mettre à jour le scoring détaillé
      const existingScoring = await db
        .select()
        .from(callScoring)
        .where(eq(callScoring.callId, callId))
        .limit(1);

      if (existingScoring.length > 0) {
        await db
          .update(callScoring)
          .set({
            ...scoringData,
            updatedAt: new Date(),
          })
          .where(eq(callScoring.callId, callId));
      } else {
        await db.insert(callScoring).values(scoringData);
      }

      // 7. Déclencher les workflows automatisés
      await triggerCallCompletedWorkflow({
        tenantId,
        callId,
        duration,
        prospectId: call.prospectId || undefined,
        status: "completed"
      });

      // 8. Alerte si score critique
      if (finalScore < 40 || aiQuality.sentiment === "negative") {
        logger.warn("[CallScoringService] Critical call quality detected", {
          callId,
          tenantId,
          score: finalScore,
          sentiment: aiQuality.sentiment
        });
        
        // On pourrait déclencher un workflow spécifique ici
      }

      logger.info("[CallScoringService] Call scored successfully with AI", { 
        callId, 
        finalScore, 
        duration_ms: Date.now() - startTime 
      });

      return true;
    } catch (error: any) {
      logger.error("[CallScoringService] Failed to score call with AI", { error, callId });
      return false;
    }
  }

  /**
   * Récupère le score d'un appel
   */
  static async getScore(callId: number) {
    try {
      const db = getDbInstance();
      if (!db) return null;

      const results = await db
        .select()
        .from(callScoring)
        .where(eq(callScoring.callId, callId))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    } catch (error: any) {
      logger.error("[CallScoringService] Failed to get score", { error, callId });
      return null;
    }
  }

  /**
   * Récupère le score moyen pour un tenant
   */
  static async getAverageScore(tenantId: number): Promise<number> {
    try {
      const db = getDbInstance();
      if (!db) return 0;

      const results = await db
        .select()
        .from(callScoring)
        .where(eq(callScoring.tenantId, tenantId));

      if (results.length === 0) return 0;

      const sum = results.reduce((acc: number, score: any) => acc + (parseFloat(score.overallScore ?? "0") * 100), 0);
      return Math.round(sum / results.length);
    } catch (error: any) {
      logger.error("[CallScoringService] Failed to get average score", { error, tenantId });
      return 0;
    }
  }

  /**
   * Récupère tous les scores pour un tenant avec filtres
   */
  static async listScores(tenantId: number, limit = 50, offset = 0) {
    try {
      const db = getDbInstance();
      if (!db) return [];

      const results = await db
        .select()
        .from(callScoring)
        .where(eq(callScoring.tenantId, tenantId))
        .limit(limit)
        .offset(offset);

      return results;
    } catch (error: any) {
      logger.error("[CallScoringService] Failed to list scores", { error, tenantId });
      return [];
    }
  }
}