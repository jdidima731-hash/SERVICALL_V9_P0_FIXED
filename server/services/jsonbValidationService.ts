/**
 * JSONB VALIDATION SERVICE
 * ────────────────────────────────────────────────────────
 * Service centralisé pour valider et mapper les structures JSONB critiques.
 * Utilisé par tous les services qui manipulent des données dynamiques.
 *
 * BLOC 1 : Hardening JSONB + IA
 */

import {
  validateAIGeneratedProfile,
  validateWebhookPayload,
  validateServiceMetadata,
  validateWorkflowInput,
  validateWorkflowOutput,
  mapToAIGeneratedProfile,
  mapToWebhookPayload,
  mapToServiceMetadata,
  mapToWorkflowInput,
  mapToWorkflowOutput,
  type AIGeneratedProfile,
  type WebhookPayload,
  type ServiceMetadata,
  type WorkflowInput,
  type WorkflowOutput,
} from "@shared/validation/jsonb-critical";
import {
  validatePOSConfig,
  validateTriggerConfig,
  validateAgentSwitchSettings,
  validateBillingConfig,
  mapToPOSConfig,
  mapToTriggerConfig,
  mapToAgentSwitchSettings,
  mapToBillingConfig,
  type POSConfig,
  type TriggerConfig,
  type AgentSwitchSettings,
  type BillingConfig,
} from "@shared/validation/jsonb-business-config";
import {
  validateConversationHistory,
  validateCVParsedData,
  validateMatchingDetails,
  validateCallTranscript,
  validateInterviewAnalysis,
  mapToConversationHistory,
  mapToCVParsedData,
  type ConversationHistory,
  type CVParsedData,
  type MatchingDetails,
  type CallTranscript,
  type InterviewAnalysis,
} from "@shared/validation/jsonb-history-analysis";
import { logger } from "../infrastructure/logger";

export class JSONBValidationService {
  /**
   * Valide et retourne un profil IA généré
   */
  static validateAIGeneratedProfile(data: unknown): AIGeneratedProfile {
    try {
      return validateAIGeneratedProfile(data);
    } catch (error) {
      logger.error("JSONB: AI Generated Profile validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide un profil IA généré
   */
  static mapAIGeneratedProfile(data: unknown): AIGeneratedProfile {
    try {
      return mapToAIGeneratedProfile(data);
    } catch (error) {
      logger.error("JSONB: AI Generated Profile mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne un payload webhook
   */
  static validateWebhookPayload(data: unknown): WebhookPayload {
    try {
      return validateWebhookPayload(data);
    } catch (error) {
      logger.error("JSONB: Webhook Payload validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide un payload webhook
   */
  static mapWebhookPayload(data: unknown): WebhookPayload {
    try {
      return mapToWebhookPayload(data);
    } catch (error) {
      logger.error("JSONB: Webhook Payload mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne des métadonnées de service
   */
  static validateServiceMetadata(data: unknown): ServiceMetadata {
    try {
      return validateServiceMetadata(data);
    } catch (error) {
      logger.error("JSONB: Service Metadata validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide des métadonnées de service
   */
  static mapServiceMetadata(data: unknown): ServiceMetadata {
    try {
      return mapToServiceMetadata(data);
    } catch (error) {
      logger.error("JSONB: Service Metadata mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne un input de workflow
   */
  static validateWorkflowInput(data: unknown): WorkflowInput {
    try {
      return validateWorkflowInput(data);
    } catch (error) {
      logger.error("JSONB: Workflow Input validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide un input de workflow
   */
  static mapWorkflowInput(data: unknown, tenantId: number): WorkflowInput {
    try {
      return mapToWorkflowInput(data, tenantId);
    } catch (error) {
      logger.error("JSONB: Workflow Input mapping failed", { error, data, tenantId });
      throw error;
    }
  }

  /**
   * Valide et retourne un output de workflow
   */
  static validateWorkflowOutput(data: unknown): WorkflowOutput {
    try {
      return validateWorkflowOutput(data);
    } catch (error) {
      logger.error("JSONB: Workflow Output validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide un output de workflow
   */
  static mapWorkflowOutput(data: unknown): WorkflowOutput {
    try {
      return mapToWorkflowOutput(data);
    } catch (error) {
      logger.error("JSONB: Workflow Output mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne une configuration POS
   */
  static validatePOSConfig(data: unknown): POSConfig {
    try {
      return validatePOSConfig(data);
    } catch (error) {
      logger.error("JSONB: POS Config validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide une configuration POS
   */
  static mapPOSConfig(data: unknown): POSConfig {
    try {
      return mapToPOSConfig(data);
    } catch (error) {
      logger.error("JSONB: POS Config mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne une configuration de trigger
   */
  static validateTriggerConfig(data: unknown): TriggerConfig {
    try {
      return validateTriggerConfig(data);
    } catch (error) {
      logger.error("JSONB: Trigger Config validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide une configuration de trigger
   */
  static mapTriggerConfig(data: unknown): TriggerConfig {
    try {
      return mapToTriggerConfig(data);
    } catch (error) {
      logger.error("JSONB: Trigger Config mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne des paramètres de switch d'agent
   */
  static validateAgentSwitchSettings(data: unknown): AgentSwitchSettings {
    try {
      return validateAgentSwitchSettings(data);
    } catch (error) {
      logger.error("JSONB: Agent Switch Settings validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide des paramètres de switch d'agent
   */
  static mapAgentSwitchSettings(data: unknown): AgentSwitchSettings {
    try {
      return mapToAgentSwitchSettings(data);
    } catch (error) {
      logger.error("JSONB: Agent Switch Settings mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne une configuration de facturation
   */
  static validateBillingConfig(data: unknown): BillingConfig {
    try {
      return validateBillingConfig(data);
    } catch (error) {
      logger.error("JSONB: Billing Config validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide une configuration de facturation
   */
  static mapBillingConfig(data: unknown): BillingConfig {
    try {
      return mapToBillingConfig(data);
    } catch (error) {
      logger.error("JSONB: Billing Config mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne un historique de conversation
   */
  static validateConversationHistory(data: unknown): ConversationHistory {
    try {
      return validateConversationHistory(data);
    } catch (error) {
      logger.error("JSONB: Conversation History validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide un historique de conversation
   */
  static mapConversationHistory(data: unknown): ConversationHistory {
    try {
      return mapToConversationHistory(data);
    } catch (error) {
      logger.error("JSONB: Conversation History mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne des données de CV extraites
   */
  static validateCVParsedData(data: unknown): CVParsedData {
    try {
      return validateCVParsedData(data);
    } catch (error) {
      logger.error("JSONB: CV Parsed Data validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Mappe et valide des données de CV extraites
   */
  static mapCVParsedData(data: unknown): CVParsedData {
    try {
      return mapToCVParsedData(data);
    } catch (error) {
      logger.error("JSONB: CV Parsed Data mapping failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne des détails de matching
   */
  static validateMatchingDetails(data: unknown): MatchingDetails {
    try {
      return validateMatchingDetails(data);
    } catch (error) {
      logger.error("JSONB: Matching Details validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne une transcription d'appel
   */
  static validateCallTranscript(data: unknown): CallTranscript {
    try {
      return validateCallTranscript(data);
    } catch (error) {
      logger.error("JSONB: Call Transcript validation failed", { error, data });
      throw error;
    }
  }

  /**
   * Valide et retourne une analyse d'entretien
   */
  static validateInterviewAnalysis(data: unknown): InterviewAnalysis {
    try {
      return validateInterviewAnalysis(data);
    } catch (error) {
      logger.error("JSONB: Interview Analysis validation failed", { error, data });
      throw error;
    }
  }
}

export const jsonbValidationService = new JSONBValidationService();
