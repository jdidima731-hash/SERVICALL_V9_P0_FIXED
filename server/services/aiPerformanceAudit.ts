import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { logger } from "../infrastructure/logger";
import { AI_MODEL } from "../_core/aiModels";

export interface PerformanceInsight {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  recommendation: string;
}

export async function generateWeeklyPerformanceAudit(tenantId: number): Promise<PerformanceInsight[]> {
  try {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    // Récupérer les dernières transcriptions d'appels pour ce tenant
    const calls = await db.select()
      .from(schema.calls)
      .where(and(
        eq(schema.calls.tenantId, tenantId),
        eq(schema.calls.status, "completed")
      ))
      .orderBy(desc(schema.calls.createdAt))
      .limit(20);

    if (calls.length === 0) {
      return [
        {
          title: "Données insuffisantes",
          description: "Pas assez d'appels pour générer un audit de performance.",
          impact: "low",
          recommendation: "Continuez à utiliser la plateforme pour collecter des données."
        }
      ];
    }

    const transcriptions = calls.map(c => c.transcription).filter(Boolean).join("\n---\n");

    const systemPrompt = `Tu es un expert en audit de performance pour centres d'appels IA. 
    Analyse les transcriptions suivantes et identifie les points de friction récurrents (objections, hésitations, incompréhensions).
    Génère un rapport stratégique sous forme de JSON: { insights: Array<{ title: string, description: string, impact: 'high'|'medium'|'low', recommendation: string }> }`;

    const response = await invokeLLM(tenantId, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Transcriptions des appels récents:\n\n${transcriptions}` }
      ],
      response_format: { type: "json_object" }
    });

    const content = (response as unknown).choices[0]?.message?.content;
    const data = JSON.parse(content || '{"insights": []}');
    
    return data.insights || [];
  } catch (error: any) {
    logger.error("[AI Performance Audit] Error generating audit", error);
    return [];
  }
}
