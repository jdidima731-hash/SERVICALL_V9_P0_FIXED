import { eq, and, desc, sql } from "drizzle-orm";
import { getDbInstance } from "../db";
import { commandValidations, calls } from "../../drizzle/schema";
import { logger } from "../infrastructure/logger";

/**
 * Service de Transparence IA - Suivi des métriques de performance et décisions
 */

export interface IAMetrics {
  totalDecisions: number;
  aiDecisions: number;
  humanDecisions: number;
  automationRate: number;
  agreementRate: number;
  falsePositives: number;
  falseNegatives: number;
  avgAiScore: number;
  avgHumanScore: number;
}

export interface AIDecisionLog {
  id: number;
  callId: number;
  decision: string;
  reasoning: string;
  confidence: number;
  timestamp: Date;
  modelUsed: string;
}

export class AITransparencyService {
  /**
   * Calcule les métriques de transparence pour un tenant
   */
  static async getTransparencyMetrics(tenantId: number): Promise<IAMetrics> {
    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      const validations = await db
        .select()
        .from(commandValidations)
        .where(eq(commandValidations.tenantId, tenantId));

      const totalDecisions = validations.length;
      const aiDecisions = validations.filter((v: any) => v.validatedBy?.includes("IA")).length;
      const humanDecisions = validations.filter((v: any) => v.validatedBy?.includes("Humain")).length;

      let falsePositives = 0;
      let falseNegatives = 0;

      validations.forEach((v: any) => {
        if (v.status === "approved" && v.validationScore && v.validationScore < 50) falsePositives++;
        if (v.status === "rejected" && v.validationScore && v.validationScore > 80) falseNegatives++;
      });

      return {
        totalDecisions,
        aiDecisions,
        humanDecisions,
        automationRate: totalDecisions > 0 ? (aiDecisions / totalDecisions) * 100 : 0,
        agreementRate: 88, // Simulé pour l'exemple
        falsePositives,
        falseNegatives,
        avgAiScore: aiDecisions > 0 
          ? validations.filter((v: Record<string, unknown>) => (v["validatedBy"] as string)?.includes("IA")).reduce((acc: number, v: Record<string, unknown>) => acc + ((v["validationScore"] as number) || 0), 0) / aiDecisions
          : 0,
        avgHumanScore: humanDecisions > 0
          ? validations.filter((v: Record<string, unknown>) => (v["validatedBy"] as string)?.includes("Humain")).reduce((acc: number, v: Record<string, unknown>) => acc + ((v["validationScore"] as number) || 0), 0) / humanDecisions
          : 0,
      };
    } catch (error: any) {
      logger.error("[AITransparencyService] Failed to get transparency metrics", { error, tenantId });
      return {
        totalDecisions: 0, aiDecisions: 0, humanDecisions: 0, automationRate: 0,
        agreementRate: 0, falsePositives: 0, falseNegatives: 0, avgAiScore: 0, avgHumanScore: 0,
      };
    }
  }

  /**
   * Récupère les logs de décision détaillés de l'IA
   */
  static async getAIDecisionLogs(tenantId: number, limit: number = 20): Promise<AIDecisionLog[]> {
    const db = getDbInstance();
    
    // On utilise les appels avec scoring IA comme source de logs de décision
    const recentCalls = await db.select()
      .from(calls)
      .where(and(eq(calls.tenantId, tenantId), sql`${calls.callType} = 'ai'`))
      .orderBy(desc(calls.createdAt))
      .limit(limit);

    
    return recentCalls.map((c: Record<string, unknown>) => ({
      id: c["id"],
      callId: c["id"],
      decision: parseFloat((c["qualityScore"] as string) || "0") > 0.7 ? "Qualified" : "Needs Review",
      reasoning: (c["summary"] as string) || "Analyse automatique basée sur la transcription.",
      confidence: Math.round(parseFloat((c["qualityScore"] as string) || "0") * 100),
      timestamp: c["createdAt"],
      modelUsed: "GPT-4o-mini"
    }));
  }
}