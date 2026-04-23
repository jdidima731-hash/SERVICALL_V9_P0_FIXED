import OpenAI from "openai";
import { ENV } from "./env";
import { logger } from "../infrastructure/logger";
let openaiClientInstance: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (openaiClientInstance) {
    return openaiClientInstance;
  }
  if (!ENV.openaiApiKey) {
    logger.warn("[OpenAI Client] OPENAI_API_KEY n'est pas configurée. Le client OpenAI fonctionnera en mode dégradé (erreurs lors des appels).");
    // Retourner un client factice — les appels échoueront côté OpenAI avec une erreur 401 explicite.
    // Ne pas utiliser dangerouslyAllowBrowser (antipattern Node.js).
    return new OpenAI({ apiKey: "missing-key" });
  }
  const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: ENV.openaiApiKey,
    timeout: 30000,
    maxRetries: 0,
  };
  // Utiliser l'URL personnalisée si définie (proxy Manus ou autre)
  if (ENV.openaiApiUrl && ENV.openaiApiUrl !== "https://api.openai.com/v1") {
    clientConfig.baseURL = ENV.openaiApiUrl;
    logger.info(`[OpenAI Client] Utilisation du proxy: ${ENV.openaiApiUrl}`);
  }
  openaiClientInstance = new OpenAI(clientConfig);
  logger.info("[OpenAI Client] Client OpenAI initialisé avec timeout=30000ms.");
  return openaiClientInstance;
}
/**
 * Réinitialise l'instance (utile pour les tests)
 */
export function resetOpenAIClient(): void {
  openaiClientInstance = null;
}
