/**
 * AI Call Center Service - Orchestration de l'autonomie IA complète
 * Gère les appels entrants/sortants sans intervention humaine par défaut.
 */

import { generateAIResponse, qualifyCallerFromTranscription } from "./aiService";

import { transferCall, endCall } from "./twilioService";
import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { prospects } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export class AICallCenterService {
  /**
   * Traiter un message entrant (voix transcrite) et décider de la suite
   */
  static async processIncomingTurn(
    callSid: string,
    transcription: string,
    context: {
      prospectId?: number;
      tenantId: number;
      callReason?: string;
      tenantName?: string;
    }
  ): Promise<{ response: string; action: "continue" | "transfer" | "end" }> {
    logger.info(`[AI-CallCenter] Processing turn for call ${callSid}`, { transcription });

    // 1. Détection de demande de transfert humain (Mots-clés prioritaires)
    const humanKeywords = ["agent", "humain", "personne", "responsable", "conseiller", "parler à quelqu'un"];
    const wantsHuman = humanKeywords.some(kw => transcription.toLowerCase().includes(kw));

    if (wantsHuman) {
      logger.info(`[AI-CallCenter] Human agent requested by caller for call ${callSid}`);
      return {
        response: "Je comprends. Je vous transfère immédiatement à un conseiller. Veuillez patienter.",
        action: "transfer"
      };
    }

    // 2. Analyse de sentiment et urgence pour transfert automatique
    // Si le client est très énervé ou si l'urgence est critique, on transfère
    if (transcription.length > 20) {
      const qualification = await qualifyCallerFromTranscription(transcription, "unknown");
      if (qualification.urgency === "high" || qualification.shouldTransferToAgent) {
        logger.info(`[AI-CallCenter] Automatic transfer triggered by high urgency/sentiment for call ${callSid}`);
        return {
          response: "Votre demande nécessite l'intervention d'un spécialiste. Je vous transfère tout de suite.",
          action: "transfer"
        };
      }
    }

    // 3. Génération de la réponse IA autonome
    const db = getDbInstance();
    let prospectName = "Client";
    if (context.prospectId) {
      const [prospect] = await db.select().from(prospects).where(eq(prospects.id, context.prospectId)).limit(1);
      if (prospect) prospectName = `${prospect.firstName} ${prospect.lastName}`;
    }

    const aiResponse = await generateAIResponse(transcription, {
      tenantId: context.tenantId,
      prospectName,
      callReason: context.callReason || "Demande générale",
      tenantName: context.tenantName ?? "Servicall"
    });

    return {
      response: aiResponse,
      action: "continue"
    };
  }

  /**
   * Exécuter l'action décidée par l'orchestrateur
   */
  static async executeAction(
    callSid: string,
    action: "continue" | "transfer" | "end",
    agentPhone?: string
  ): Promise<void> {
    switch (action) {
      case "transfer":
        if (agentPhone) {
          await transferCall(callSid, agentPhone);
        } else {
          logger.warn(`[AI-CallCenter] Transfer requested but no agent phone provided for call ${callSid}`);
        }
        break;
      case "end":
        await endCall(callSid);
        break;
      default:
        // Continue: Twilio attendra le prochain tour
        break;
    }
  }
}
