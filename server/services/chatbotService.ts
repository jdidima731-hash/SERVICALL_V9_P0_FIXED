import { DialogueEngineService } from "./DialogueEngineService";
import type { DialogueOutput } from "./DialogueEngineService";
import { DialogueScenario } from "../../shared/types/dialogue";
import { logger } from "../infrastructure/logger";

interface ChatbotConfig {
  platform: "whatsapp" | "web";
  tenantId: number;
  sessionId: string; // ex: numéro de téléphone pour WhatsApp, ID de session pour le web
}

export class ChatbotService {
  private dialogueEngine: DialogueEngineService;
  private config: ChatbotConfig;

  constructor(config: ChatbotConfig) {
    this.config = config;
    this.dialogueEngine = new DialogueEngineService();
    logger.info(`[ChatbotService] Initialized for ${config.platform}:${config.sessionId}`);
  }

  /**
   * Traite un message entrant et retourne la réponse de l'IA.
   * @param message Le message de l'utilisateur.
   * @param scenarioId L'ID du scénario de dialogue à utiliser.
   * @param prospectId L'ID du prospect associé (peut être créé à la volée).
   */
  async handleIncomingMessage(
    message: string,
    scenarioId: string,
    prospectId: number
  ): Promise<DialogueOutput> {
    try {
      // Charger le scénario réel depuis la base de données
      const { db } = await import("../db");
      const { dialogueScenarios } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const scenarioResults = await db.select().from(dialogueScenarios)
        .where(eq(dialogueScenarios.id, scenarioId))
        .limit(1);

      if (scenarioResults.length === 0) {
        throw new Error(`Scenario ${scenarioId} not found`);
      }

      const scenario = scenarioResults[0].config ;

      // Vérifier si la conversation existe déjà
      let context = await this.dialogueEngine.getConversationContext(this.config.sessionId);

      if (!context) {
        await this.dialogueEngine.initializeConversation(
          this.config.sessionId,
          scenario,
          this.config.tenantId,
          prospectId
        );
      }

      // Traiter le message de l'utilisateur via le DialogueEngine
      const output = await this.dialogueEngine.processInput(
        this.config.sessionId,
        {
          text: message,
          tenantId: this.config.tenantId,
          prospectId: prospectId,
          callId: this.config.sessionId,
        },
        scenario
      );

      logger.info(`[ChatbotService] Response generated for ${this.config.platform}:${this.config.sessionId}`, { response: output.response });
      return output;

    } catch (error: any) {
      logger.error(`[ChatbotService] Error handling message for ${this.config.platform}:${this.config.sessionId}`, { error });
      throw new Error("Failed to process chatbot message");
    }
  }
}
