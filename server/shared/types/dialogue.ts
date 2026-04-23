/**
 * SHARED TYPES — DIALOGUE
 * Re-export depuis shared/types/dialogue pour aligner les chemins d'import
 * server/services/* → "../../../shared/types/dialogue" résout ici
 * puis on délègue vers le vrai fichier racine.
 */
export type {
  DialogueScenario,
  DialogueState,
  Transition,
  ConversationContext,
  Action,
  DialogueInput,
  DialogueOutput,
} from "../../../shared/types/dialogue";
