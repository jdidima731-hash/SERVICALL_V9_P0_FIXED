/**
 * AI Core Routers (Groupe 2)
 * Contient tous les routers liés à l'IA générale, dialogue et suggestions
 * Scission de aiAutomationRouters pour réduire la profondeur d'inférence tRPC
 */

import { router } from "../_core/trpc";
import { aiRouter } from "./aiRouter";
import { dialogueRouter } from "./dialogueRouter";
import { aiSuggestionsRouter } from "./aiSuggestionsRouter";
import { copilotRouter } from "./copilotRouter";

export const aiCoreRouter = router({
  ai: aiRouter,
  dialogue: dialogueRouter,
  aiSuggestions: aiSuggestionsRouter,
  copilot: copilotRouter,
});
