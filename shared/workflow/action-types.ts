import { z } from "zod";

export const ACTION_TYPES = [
  "create_lead",
  "update_lead",
  "create_appointment",
  "create_reservation",
  "create_task",
  "add_note",
  "crm_change_status",
  "add_tag",
  "assign_agent",
  "export_data",
  "receive_call",
  "initiate_call",
  "record_call",
  "transcribe_call",
  "send_sms",
  "send_whatsapp",
  "send_email",
  "notify_agent",
  "speak_to_caller",
  "listen_and_understand",
  "query_business_entities",
  "ai_score",
  "ai_sentiment_analysis",
  "ai_summary",
  "ai_intent",
  "ai_cv_detect",
  "ai_cv_extract",
  "ai_cv_classify",
  "ai_calculate",
  "request_payment",
  "create_order",
  "create_donation",
  "logic_if_else",
  "tech_webhook",
  "drive_action",
] as const;

export const ActionTypeSchema = z.enum(ACTION_TYPES);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export type ActionCategory =
  | "crm"
  | "telephony"
  | "messaging"
  | "dialogue"
  | "ai"
  | "payment"
  | "logic"
  | "technical";

export interface ActionMetadata {
  type: ActionType;
  category: ActionCategory;
  label: string;
  description: string;
}

export const ACTION_METADATA: Record<ActionType, ActionMetadata> = {
  create_lead: { type: "create_lead", category: "crm", label: "Créer lead", description: "Crée un nouveau lead CRM" },
  update_lead: { type: "update_lead", category: "crm", label: "Mettre à jour lead", description: "Met à jour un lead existant" },
  create_appointment: { type: "create_appointment", category: "crm", label: "Créer RDV", description: "Planifie un rendez-vous" },
  create_reservation: { type: "create_reservation", category: "crm", label: "Créer réservation", description: "Crée une réservation" },
  create_task: { type: "create_task", category: "crm", label: "Créer tâche", description: "Crée une tâche de suivi" },
  add_note: { type: "add_note", category: "crm", label: "Ajouter note", description: "Ajoute une note au prospect" },
  crm_change_status: { type: "crm_change_status", category: "crm", label: "Changer statut", description: "Modifie le statut d'un prospect" },
  add_tag: { type: "add_tag", category: "crm", label: "Ajouter tag", description: "Ajoute un tag au prospect" },
  assign_agent: { type: "assign_agent", category: "crm", label: "Assigner agent", description: "Assigne un agent au prospect" },
  export_data: { type: "export_data", category: "crm", label: "Exporter données", description: "Exporte les données du prospect" },
  receive_call: { type: "receive_call", category: "telephony", label: "Recevoir appel", description: "Gère un appel entrant" },
  initiate_call: { type: "initiate_call", category: "telephony", label: "Initier appel", description: "Lance un appel sortant" },
  record_call: { type: "record_call", category: "telephony", label: "Enregistrer appel", description: "Enregistre la conversation" },
  transcribe_call: { type: "transcribe_call", category: "telephony", label: "Transcrire appel", description: "Convertit la voix en texte" },
  send_sms: { type: "send_sms", category: "messaging", label: "Envoyer SMS", description: "Envoie un SMS" },
  send_whatsapp: { type: "send_whatsapp", category: "messaging", label: "Envoyer WhatsApp", description: "Envoie un message WhatsApp" },
  send_email: { type: "send_email", category: "messaging", label: "Envoyer email", description: "Envoie un email automatique" },
  notify_agent: { type: "notify_agent", category: "messaging", label: "Notifier agent", description: "Notifie un agent humain" },
  speak_to_caller: { type: "speak_to_caller", category: "dialogue", label: "Parler à l'appelant", description: "Synthèse vocale vers l'appelant" },
  listen_and_understand: { type: "listen_and_understand", category: "dialogue", label: "Écouter et comprendre", description: "Transcription et extraction de données" },
  query_business_entities: { type: "query_business_entities", category: "dialogue", label: "Requête métier", description: "Interroge la base de données métier" },
  ai_score: { type: "ai_score", category: "ai", label: "Score IA", description: "Calcule un score IA" },
  ai_sentiment_analysis: { type: "ai_sentiment_analysis", category: "ai", label: "Sentiment IA", description: "Analyse le sentiment" },
  ai_summary: { type: "ai_summary", category: "ai", label: "Résumé IA", description: "Génère un résumé IA" },
  ai_intent: { type: "ai_intent", category: "ai", label: "Intention IA", description: "Détecte l'intention" },
  ai_cv_detect: { type: "ai_cv_detect", category: "ai", label: "Détection CV", description: "Détecte des éléments visuels" },
  ai_cv_extract: { type: "ai_cv_extract", category: "ai", label: "Extraction CV", description: "Extrait des données d'images" },
  ai_cv_classify: { type: "ai_cv_classify", category: "ai", label: "Classification CV", description: "Classifie des images" },
  ai_calculate: { type: "ai_calculate", category: "ai", label: "Calcul IA", description: "Effectue un calcul IA" },
  request_payment: { type: "request_payment", category: "payment", label: "Demander paiement", description: "Initie une demande de paiement" },
  create_order: { type: "create_order", category: "payment", label: "Créer commande", description: "Crée une commande" },
  create_donation: { type: "create_donation", category: "payment", label: "Créer don", description: "Enregistre un don" },
  logic_if_else: { type: "logic_if_else", category: "logic", label: "Condition Si ou Sinon", description: "Branchement conditionnel" },
  tech_webhook: { type: "tech_webhook", category: "technical", label: "Webhook", description: "Appelle un webhook externe" },
  drive_action: { type: "drive_action", category: "technical", label: "Google Drive", description: "Interagit avec Google Drive" },
};

export function isActionType(value: string): value is ActionType {
  return ActionTypeSchema.safeParse(value).success;
}
