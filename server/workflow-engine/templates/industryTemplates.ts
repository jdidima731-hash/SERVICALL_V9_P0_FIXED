import type { ActionType } from "../../../shared/workflow/action-types";
import type { WorkflowStepDefinition } from "../../../shared/workflow/contracts";

export type IndustryId =
  | "lawyer"
  | "craftsman"
  | "delivery"
  | "hotel"
  | "medical"
  | "restaurant"
  | "real_estate"
  | "recruitment"
  | "commerce"
  | "logistique"
  | "prospection"
  | "customer_service"
  | "services";

export interface WorkflowTemplate {
  id: string;
  industry: IndustryId;
  name: string;
  description: string;
  triggerType: "event" | "manual" | "scheduled";
  eventType?: string;
  actions: WorkflowStepDefinition[];
}

function step(id: string, type: ActionType, config: WorkflowStepDefinition["config"], order: number, label: string): WorkflowStepDefinition {
  return { id, type, config, order, label };
}

export const BLUEPRINT_LAWYER: WorkflowTemplate = {
  id: "lawyer-summary",
  industry: "lawyer",
  name: "Avocats - Résumé Juridique Automatisé",
  description: "Analyse les appels, extrait les faits juridiques et crée une tâche de suivi.",
  triggerType: "event",
  eventType: "call.completed",
  actions: [
    step("step1", "transcribe_call", {}, 1, "Transcription"),
    step("step2", "ai_summary", { type: "standard" }, 2, "Résumé Juridique"),
    step("step3", "create_task", { title: "Suivi Dossier Juridique" }, 3, "Création Tâche"),
  ],
};

export const BLUEPRINT_CRAFTSMAN: WorkflowTemplate = {
  id: "craftsman-urgent",
  industry: "craftsman",
  name: "Artisans - Gestion des Urgences",
  description: "Détecte les urgences et alerte immédiatement par SMS.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "ai_sentiment_analysis", {}, 1, "Analyse Urgence"),
    step("step2", "logic_if_else", { condition: "variables.is_urgent" }, 2, "Branchement Urgence"),
    step("step3", "send_sms", { body: "URGENCE : {{last_message}}", to: "+33000000000" }, 3, "Alerte SMS"),
  ],
};

export const BLUEPRINT_DELIVERY: WorkflowTemplate = {
  id: "delivery-score",
  industry: "delivery",
  name: "Livraison - Scoring et Qualification",
  description: "Qualifie les demandes de livraison et assigne une priorité logistique.",
  triggerType: "event",
  eventType: "prospect.created",
  actions: [
    step("step1", "ai_score", {}, 1, "Scoring Logistique"),
    step("step2", "add_tag", { tag: "Priorité Haute" }, 2, "Tag Priorité"),
  ],
};

export const BLUEPRINT_HOTEL: WorkflowTemplate = {
  id: "hotel-booking",
  industry: "hotel",
  name: "Hôtel - Réservation Automatisée",
  description: "Gère les demandes de réservation et vérifie les disponibilités.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "speak_to_caller", { text: "Bienvenue à l'hôtel." }, 1, "Accueil"),
    step("step2", "listen_and_understand", {}, 2, "Dates"),
    step("step3", "create_reservation", { type: "hotel" }, 3, "Booking"),
  ],
};

export const BLUEPRINT_MEDICAL: WorkflowTemplate = {
  id: "medical-appointment",
  industry: "medical",
  name: "Médical - Prise de RDV",
  description: "Gère les appels entrants et planifie les consultations.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "ai_intent", {}, 1, "Analyse Intention"),
    step("step2", "create_appointment", { type: "consultation" }, 2, "Prise de RDV"),
  ],
};

export const BLUEPRINT_RESTAURANT: WorkflowTemplate = {
  id: "restaurant-order",
  industry: "restaurant",
  name: "Restaurant - Prise de Commande",
  description: "Gère les commandes par téléphone et crée la commande en POS.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "listen_and_understand", {}, 1, "Commande"),
    step("step2", "create_order", {}, 2, "Création Commande"),
  ],
};

export const BLUEPRINT_REAL_ESTATE: WorkflowTemplate = {
  id: "real-estate-qualification",
  industry: "real_estate",
  name: "Immobilier - Qualification Lead",
  description: "Qualifie les prospects immobiliers et planifie les visites.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "ai_score", {}, 1, "Scoring Lead"),
    step("step2", "create_lead", {}, 2, "Création Lead"),
  ],
};

export const BLUEPRINT_RECRUITMENT: WorkflowTemplate = {
  id: "recruitment-screening",
  industry: "recruitment",
  name: "Recrutement - Présélection",
  description: "Pré-qualifie les candidats et planifie les entretiens.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "ai_score", {}, 1, "Scoring Candidat"),
    step("step2", "create_appointment", { type: "interview" }, 2, "Entretien"),
  ],
};

export const BLUEPRINT_COMMERCE: WorkflowTemplate = {
  id: "commerce-follow-up",
  industry: "commerce",
  name: "Commerce - Suivi Commande",
  description: "Gère les demandes de suivi de commande client.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "ai_intent", {}, 1, "Motif Appel"),
    step("step2", "send_email", { to: "ops@example.com", subject: "Suivi commande", template: "order_status" }, 2, "Email Suivi"),
  ],
};

export const BLUEPRINT_LOGISTIQUE: WorkflowTemplate = {
  id: "logistique-reschedule",
  industry: "logistique",
  name: "Logistique - Reprogrammation",
  description: "Permet au client de reprogrammer sa livraison.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "query_business_entities", {}, 1, "Statut Colis"),
    step("step2", "send_sms", { body: "Statut : {{shipment_status}}", to: "+33000000000" }, 2, "SMS Statut"),
  ],
};

export const BLUEPRINT_PROSPECTION: WorkflowTemplate = {
  id: "prospection-outbound",
  industry: "prospection",
  name: "Prospection - Qualification Outbound",
  description: "Qualifie les prospects lors d'appels sortants.",
  triggerType: "event",
  eventType: "call.completed",
  actions: [
    step("step1", "ai_sentiment_analysis", {}, 1, "Intérêt Client"),
    step("step2", "crm_change_status", { status: "qualified" }, 2, "Update Statut"),
  ],
};

export const BLUEPRINT_CUSTOMER_SERVICE: WorkflowTemplate = {
  id: "customer-service-ticket",
  industry: "customer_service",
  name: "SAV - Ticket Automatique",
  description: "Crée un ticket SAV à partir d'un appel client.",
  triggerType: "event",
  eventType: "call.completed",
  actions: [
    step("step1", "ai_summary", {}, 1, "Résumé Problème"),
    step("step2", "create_task", { title: "Ticket SAV" }, 2, "Ticket SAV"),
  ],
};

export const BLUEPRINT_SERVICES: WorkflowTemplate = {
  id: "services-quote",
  industry: "services",
  name: "Services - Demande de Devis",
  description: "Gère les demandes de devis pour prestations de services.",
  triggerType: "event",
  eventType: "call.received",
  actions: [
    step("step1", "listen_and_understand", {}, 1, "Besoins"),
    step("step2", "send_email", { to: "ops@example.com", subject: "Demande de devis", template: "quote_request" }, 2, "Envoi Devis"),
  ],
};

export const INDUSTRY_TEMPLATES: Record<IndustryId, WorkflowTemplate> = {
  lawyer: BLUEPRINT_LAWYER,
  craftsman: BLUEPRINT_CRAFTSMAN,
  delivery: BLUEPRINT_DELIVERY,
  hotel: BLUEPRINT_HOTEL,
  medical: BLUEPRINT_MEDICAL,
  restaurant: BLUEPRINT_RESTAURANT,
  real_estate: BLUEPRINT_REAL_ESTATE,
  recruitment: BLUEPRINT_RECRUITMENT,
  commerce: BLUEPRINT_COMMERCE,
  logistique: BLUEPRINT_LOGISTIQUE,
  prospection: BLUEPRINT_PROSPECTION,
  customer_service: BLUEPRINT_CUSTOMER_SERVICE,
  services: BLUEPRINT_SERVICES,
};

export const ALL_TEMPLATES: WorkflowTemplate[] = Object.values(INDUSTRY_TEMPLATES);

export function getTemplatesByIndustry(industryId: IndustryId): WorkflowTemplate | undefined {
  return INDUSTRY_TEMPLATES[industryId];
}

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return ALL_TEMPLATES.find((template) => template.id === id);
}
