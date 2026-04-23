import { AI_MODEL } from '../_core/aiModels';
/**
 * BLOC 3 - Shadow Agent Service
 * IA Proactive Bridée : Génère des suggestions sans jamais agir seule
 * 
 * RÈGLES DE BRIDAGE (NON NÉGOCIABLE) :
 * ❌ L'IA n'envoie JAMAIS de message seule
 * ❌ L'IA ne parle JAMAIS de prix, contrat, engagement
 * ❌ L'IA ne modifie JAMAIS une donnée critique
 * ✅ Tout contenu IA = état "À valider"
 */

import { getDbInstance } from "../db";
import * as schema from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../infrastructure/logger";
import { invokeLLM } from "../_core/llm";

/**
 * Types de suggestions IA
 */
export type AISuggestionType = 
  | "missed_call_followup"    // Relance après appel manqué
  | "inactive_prospect"        // Relance prospect inactif
  | "appointment_reminder"     // Rappel de rendez-vous
  | "qualification_followup";  // Suivi après qualification

/**
 * Statut d'une suggestion IA
 */
export type AISuggestionStatus = 
  | "pending"      // En attente de validation
  | "approved"     // Approuvée par l'humain
  | "rejected"     // Rejetée par l'humain
  | "executed";    // Exécutée (après approbation)

/**
 * Structure d'une suggestion IA
 */
export interface AISuggestion {
  id?: number;
  tenantId: number;
  prospectId: number;
  type: AISuggestionType;
  status: AISuggestionStatus;
  title: string;
  description: string;
  suggestedAction: {
    type: "send_sms" | "send_whatsapp" | "schedule_call" | "update_status";
    content?: string;
    scheduledAt?: Date;
    metadata?: any;
  };
  aiReasoning: string;
  confidence: number; // 0-100
  createdAt?: Date;
  validatedAt?: Date;
  validatedBy?: number;
  executedAt?: Date;
}

/**
 * Mots interdits pour l'IA (bridage)
 */
const FORBIDDEN_KEYWORDS = [
  "prix", "tarif", "coût", "payer", "payement", "facture",
  "contrat", "engagement", "signer", "signature",
  "garantie", "remboursement", "annulation",
  "price", "cost", "payment", "contract", "sign",
  "€", "$", "EUR", "USD"
];

/**
 * Service Shadow Agent
 */
export class ShadowAgentService {
  /**
   * Détecte les appels manqués et génère des suggestions de relance
   */
  static async detectMissedCallsAndSuggest(tenantId: number): Promise<AISuggestion[]> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");
    
    logger.info("[Shadow Agent] Detecting missed calls", { tenantId });

    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const missedCalls = await db
        .select()
        .from(schema.calls)
        .where(
          and(
            eq(schema.calls.tenantId, tenantId),
            eq(schema.calls.outcome, "no_answer"),
            sql`${schema.calls.createdAt} > ${yesterday}`
          )
        )
        .orderBy(desc(schema.calls.createdAt));

      logger.info("[Shadow Agent] Found missed calls", { 
        tenantId, 
        count: missedCalls.length 
      });

      const suggestions: AISuggestion[] = [];

      for (const call of missedCalls) {
        if (!call.prospectId) continue;

        const existingSuggestion = await db
          .select()
          .from(schema.aiSuggestions)
          .where(
            and(
              eq(schema.aiSuggestions.tenantId, tenantId),
              eq(schema.aiSuggestions.prospectId, call.prospectId),
              eq(schema.aiSuggestions.type, "missed_call_followup"),
              eq(schema.aiSuggestions.status, "pending")
            )
          )
          .limit(1);

        if (existingSuggestion.length > 0) continue;

        const [prospect] = await db
          .select()
          .from(schema.prospects)
          .where(eq(schema.prospects.id, call.prospectId))
          .limit(1);

        if (!prospect) continue;

        const suggestedMessage = await this.generateFollowUpMessage(
          prospect,
          call,
          tenantId
        );

        if (this.containsForbiddenKeywords(suggestedMessage)) continue;

        const suggestionData = {
          tenantId,
          prospectId: call.prospectId,
          type: "missed_call_followup" as const,
          status: "pending" as const,
          title: `Relance après appel manqué - ${prospect.firstName} ${prospect.lastName}`,
          description: `Appel manqué le ${call.createdAt?.toLocaleString('fr-FR')}. L'IA suggère d'envoyer un SMS de relance.`,
          suggestedAction: {
            type: "send_sms" as const,
            content: suggestedMessage,
          },
          aiReasoning: "Appel manqué détecté. Relance proactive pour maintenir l'engagement.",
          confidence: 85,
        };

        const [created] = await db
          .insert(schema.aiSuggestions)
          .values(suggestionData as any)
          .returning();

        suggestions.push(created as any as AISuggestion);
      }

      return suggestions;
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to detect missed calls", { error, tenantId });
      return [];
    }
  }

  private static async generateFollowUpMessage(
    prospect: any,
    call: any,
    tenantId: number
  ): Promise<string> {
    try {
      const systemPrompt = `Tu es un assistant de relation client professionnel.
Génère un SMS de relance court et courtois (max 160 caractères) pour un prospect qui n'a pas répondu à un appel.
RÈGLES STRICTES : Ne JAMAIS mentionner de prix, tarif, contrat.
Réponds UNIQUEMENT avec le texte du SMS.`;

      const userPrompt = `Prospect: ${prospect.firstName} ${prospect.lastName}
Contexte: Appel manqué le ${call.createdAt?.toLocaleDateString('fr-FR')}`;

      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const messageContent = response.choices[0]?.message?.content;
      let message = typeof messageContent === 'string' ? messageContent.trim() : "";
      
      if (this.containsForbiddenKeywords(message)) {
        return `Bonjour ${prospect.firstName}, nous avons essayé de vous joindre. Pouvons-nous vous rappeler ?`;
      }

      message = message.replace(/^["']|["']$/g, "");
      if (message.length > 160) message = message.substring(0, 157) + "...";

      return message;
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to generate follow-up message", { error });
      return `Bonjour ${prospect.firstName}, nous avons essayé de vous joindre. Pouvons-nous vous rappeler ?`;
    }
  }

  private static containsForbiddenKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return FORBIDDEN_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  static async getPendingSuggestions(tenantId: number): Promise<AISuggestion[]> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");
    
    try {
      const suggestions = await db
        .select()
        .from(schema.aiSuggestions)
        .where(
          and(
            eq(schema.aiSuggestions.tenantId, tenantId),
            eq(schema.aiSuggestions.status, "pending")
          )
        )
        .orderBy(desc(schema.aiSuggestions.createdAt));

      return suggestions as any as AISuggestion[];
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to get pending suggestions", { error, tenantId });
      return [];
    }
  }

  static async approveSuggestion(
    suggestionId: number,
    tenantId: number,
    userId: number
  ): Promise<{ success: boolean; message: string }> {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");
    
    try {
      const [suggestion] = await db
          .select()
          .from(schema.aiSuggestions)
          .where(
            and(
              eq(schema.aiSuggestions.id, suggestionId),
              eq(schema.aiSuggestions.tenantId, tenantId)
            )
          )
          .limit(1) as any as AISuggestion[];

      if (!suggestion) return { success: false, message: "Suggestion non trouvée" };
      if (suggestion.status !== "pending") return { success: false, message: "Suggestion déjà traitée" };

      await db.update(schema.aiSuggestions)
        .set({
          status: "approved",
          validatedAt: new Date(),
          validatedBy: userId,
        })
        .where(eq(schema.aiSuggestions.id, suggestionId));

      return { success: true, message: "Suggestion approuvée" };
    } catch (error: unknown) {
      logger.error("[Shadow Agent] Failed to approve suggestion", { error, suggestionId });
      return { success: false, message: "Erreur lors de l'approbation" };
    }
  }
}
