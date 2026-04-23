import { logger } from "../infrastructure/logger";
import * as aiService from "./aiService";
import { RealtimeWorkflowMonitor } from "./realtimeWorkflowMonitor";
import WebSocket from "ws";
import { DialogueScenario, ConversationContext } from "../../shared/types/dialogue";

interface RealtimeCoachingConfig {
  callSid: string;
  tenantId: number;
  agentId: number; // L'ID de l'agent humain à coacher
  ws: WebSocket; // WebSocket pour envoyer les suggestions à l'agent
}

interface CoachingSuggestion {
  type: "suggestion" | "alert" | "script_prompt";
  message: string;
  timestamp: number;
  confidence?: number;
}

export class RealtimeAgentCoachingService {
  private config: RealtimeCoachingConfig;
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

  constructor(config: RealtimeCoachingConfig) {
    this.config = config;
    logger.info("[RealtimeCoaching] Service initialized", { callSid: config.callSid, agentId: config.agentId });
  }

  /**
   * Traite un tour de conversation et génère des suggestions de coaching en temps réel.
   * @param userUtterance La transcription de ce que l'utilisateur a dit.
   * @param aiResponse La réponse générée par l'IA.
   * @param currentContext Le contexte actuel de la conversation (incluant prospect, campagne, etc.).
   */
  async processConversationTurn(
    userUtterance: string,
    aiResponse: string,
    currentContext: Record<string, unknown> // Contexte de coaching en cours
  ): Promise<void> {
    this.conversationHistory.push({ role: "user", content: userUtterance });
    this.conversationHistory.push({ role: "assistant", content: aiResponse });

    // Limiter l'historique pour éviter l'envoi de trop de données à l'IA
    const recentHistory = this.conversationHistory.slice(-6); // Garder les 3 derniers tours

    const prompt = `
Tu es un coach d'agent de centre d'appels expert. Ton rôle est d'écouter la conversation en temps réel et de fournir des suggestions utiles à l'agent humain.
La conversation actuelle est entre un agent humain et un client. Voici le contexte de l'appel:
- Prospect: ${JSON.stringify(currentContext.prospect || {})}
- Campagne: ${JSON.stringify(currentContext.campaign || {})}

Voici les derniers échanges de la conversation:
${recentHistory.map(msg => `${msg.role === "user" ? "Client" : "Agent"}: ${msg.content}`).join("\n")}

En te basant sur ces informations, génère une suggestion de coaching concise pour l'agent humain. La suggestion doit être pertinente, actionable et aider l'agent à mieux gérer l'appel ou à atteindre l'objectif de la campagne.
Si aucune suggestion n'est nécessaire, réponds simplement "AUCUNE_SUGGESTION".

Exemples de suggestions:
- "Rappelez le bénéfice X du produit."
- "Demandez si le client a des questions sur le prix."
- "Proposez l'option de paiement en 3 fois."
- "Rebondissez sur l'objection concernant le délai de livraison."
- "Confirmez le rendez-vous pour jeudi prochain."

Suggestion:
`;

    try {
      await RealtimeWorkflowMonitor.updateCurrentAction(this.config.callSid, "realtime_coaching_inference");
      const aiCoachingResponse = await aiService.generateCompletion({
        prompt,
        systemPrompt: "Tu es un coach d'agent de centre d'appels expert.",
        temperature: 0.5,
        maxTokens: 100,
      });

      if (aiCoachingResponse && aiCoachingResponse.trim() !== "AUCUNE_SUGGESTION") {
        const suggestion: CoachingSuggestion = {
          type: "suggestion",
          message: aiCoachingResponse.trim(),
          timestamp: Date.now(),
        };
        this.sendCoachingSuggestion(suggestion);
        logger.info("[RealtimeCoaching] Suggestion sent", { callSid: this.config.callSid, suggestion: suggestion.message });
      }
      await RealtimeWorkflowMonitor.recordActionSuccess(this.config.callSid, "realtime_coaching_inference");
    } catch (error: any) {
      logger.error("[RealtimeCoaching] Error generating suggestion", { callSid: this.config.callSid, error });
      await RealtimeWorkflowMonitor.recordActionFailure(this.config.callSid, "realtime_coaching_inference", error instanceof Error ? error.message : String(error));
    }
  }

  private sendCoachingSuggestion(suggestion: CoachingSuggestion): void {
    if (this.config.ws.readyState === WebSocket.OPEN) {
      // Envoyer la suggestion via WebSocket à l'agent (le frontend devra écouter cet événement)
      this.config.ws.send(JSON.stringify({ event: "coaching_suggestion", payload: suggestion }));
    } else {
      logger.warn("[RealtimeCoaching] WebSocket not open, cannot send suggestion", { callSid: this.config.callSid });
    }
  }
}
