/**
 * Coach Service - Assistant IA pour les agents humains
 * Fournit des conseils en temps réel et des scripts dynamiques.
 */

import { invokeLLM } from "../_core/llm";
import { logger } from "../infrastructure/logger";
import { AI_MODEL } from "../_core/aiModels";

export interface CoachAdvice {
  suggestion: string;
  nextBestAction: string;
  objectionHandling?: string;
  sentiment: string;
}


/**
 * parseFeedbackSafe — Parse JSON LLM sans crash si réponse invalide.
 */
function parseFeedbackSafe(raw: string): any {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export class CoachService {
  /**
   * Générer un conseil en temps réel basé sur la transcription actuelle
   */
  static async getRealTimeAdvice(
    transcription: string, 
    prospectContext: { firstName: string; lastName?: string; company?: string },
    callReason: string,
    // ✅ BLOC 1 FIX (TS2554) : tenantId requis par invokeLLM(tenantId, params)
    tenantId: number = 1
  ): Promise<CoachAdvice> {
    try {
      const systemPrompt = `Tu es un coach de vente expert pour les agents de centre d'appels.
Analyse la transcription actuelle de l'appel et donne des conseils stratégiques à l'agent.
Sois très concis, direct et actionnable.

Contexte du prospect:
- Nom: ${prospectContext.firstName} ${prospectContext.lastName}
- Entreprise: ${prospectContext.company ?? "Inconnue"}
- Raison de l'appel: ${callReason}

Réponds en JSON avec:
- suggestion: Un conseil immédiat sur le ton ou l'approche.
- nextBestAction: La prochaine question ou affirmation à dire.
- objectionHandling: Comment répondre à une objection si présente (optionnel).
- sentiment: Le sentiment actuel du prospect (positif, neutre, négatif).`;

      // ✅ BLOC 1 FIX (TS2554) : invokeLLM requiert (tenantId: number, params: InvokeParams)
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: `Transcription actuelle:\n${transcription}` }
        ],
        response_format: { type: "json_object" }
      });

      
      const content = response.content ?? "";
      // ✅ R1: parseFeedbackSafe
      const advice = parseFeedbackSafe(typeof content === "string" ? content : "{}");

      logger.info(`[Coach] Generated advice for call`, { sentiment: advice.sentiment });

      return {
        suggestion: typeof advice.suggestion === 'string' ? advice.suggestion : "Continuez l'écoute active.",
        nextBestAction: typeof advice.nextBestAction === 'string' ? advice.nextBestAction : "Posez une question ouverte sur ses besoins.",
        objectionHandling: typeof advice.objectionHandling === 'string' ? advice.objectionHandling : undefined,
        sentiment: typeof advice.sentiment === 'string' ? advice.sentiment : "neutre"
      };
    } catch (error: any) {
      logger.error("[Coach] Error generating advice", { error });
      return {
        suggestion: "Restez professionnel et à l'écoute.",
        nextBestAction: "Validez les informations du prospect.",
        sentiment: "inconnu"
      };
    }
  }

  /**
   * Générer un script dynamique personnalisé
   */
  static generateDynamicScript(prospect: { firstName: string; company?: string }, businessType: string): string {
    return `Bonjour ${prospect.firstName}, je vous appelle de la part de Servicall concernant votre intérêt pour ${businessType}. 
J'ai vu que vous travaillez chez ${prospect.company || "votre entreprise"} et je souhaitais discuter de la manière dont nous pouvons vous aider.`;
  }
}
