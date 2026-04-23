export interface DialogueScenario {
  id: string;
  name: string;
  industry: string;
  initialState: string;
  fallbackState?: string; // État vers lequel basculer en cas d'incompréhension
  states: DialogueState[];
  context?: ConversationContext;
}

export interface DialogueState {
  id: string;
  name: string;
  onEnter: Action[];
  transitions: Transition[];
  timeout?: number;
  isFallback?: boolean; // Marque cet état comme étant un état de repli
}

export interface Transition {
  condition: string; // Expression évaluée (ex: "intent === 'order_food'")
  targetState: string;
  priority?: number; // Priorité de la transition
}

export interface ConversationContext {
  lastIntent?: string;
  lastUserInput?: string;
  history?: string[]; // Historique des états pour gérer le retour arrière
  [key: string]: any; // Données collectées pendant la conversation
}

export interface Action {
  type: string;
  config: Record<string, any>;
}

export interface DialogueInput {
  text: string;
  callId: string;
  prospectId: number;
  tenantId: number;
  workflowId?: string; // Pour supporter plusieurs workflows en parallèle
}

export interface DialogueOutput {
  response: string; // Texte à prononcer par l'IA
  nextState: string; // Prochain état du dialogue
  actionsExecuted: Array<Record<string, unknown>>; // Actions qui ont été exécutées
  context: ConversationContext; // Contexte mis à jour
}
