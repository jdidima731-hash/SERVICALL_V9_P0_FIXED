/**
 * UX IMPROVEMENTS CONSTANTS
 * Glossaire, Templates de Workflows et Onboarding
 */

// ============================================
// GLOSSAIRE CONTEXTUEL
// ============================================
export const GLOSSARY = {
  WEBRTC: {
    term: "Softphone WebRTC",
    definition: "Technologie permettant de passer des appels directement depuis votre navigateur sans installer de logiciel.",
  },
  MULTI_TENANT: {
    term: "Multi-tenant",
    definition: "Architecture logicielle permettant de gérer plusieurs entreprises de manière isolée et sécurisée sur une même plateforme.",
  },
  WORKFLOW: {
    term: "Workflow",
    definition: "Séquence d'actions automatisées déclenchées par un événement spécifique (ex: fin d'appel).",
  },
  AI_SCORING: {
    term: "Scoring IA",
    definition: "Analyse automatique de l'appel par l'intelligence artificielle pour évaluer l'intérêt du prospect.",
  },
  CRM: {
    term: "CRM",
    definition: "Outil de gestion de la relation client permettant de centraliser toutes les interactions avec vos prospects.",
  },
};

// ============================================
// TEMPLATES DE WORKFLOWS AMÉLIORÉS
// ============================================
export const WORKFLOW_TEMPLATES = [
  {
    id: "tpl_followup_24h",
    name: "Rappel automatique après 24h",
    description: "Planifie une tâche de rappel si aucun rendez-vous n'a été pris 24h après l'appel.",
    trigger: "call_completed",
    actions: [
      { type: "wait", duration: "24h" },
      { type: "create_task", title: "Relancer le prospect", priority: "high" }
    ],
    icon: "Clock",
  },
  {
    id: "tpl_missed_call",
    name: "Relance après appel manqué",
    description: "Envoie un SMS automatique au client après un appel manqué pour le rassurer.",
    trigger: "call_received",
    actions: [
      { type: "send_sms", message: "Bonjour, nous avons manqué votre appel. Nous vous rappelons dès que possible !" }
    ],
    icon: "PhoneOff",
  },
  {
    id: "tpl_ai_qualification",
    name: "Qualification IA Immédiate",
    description: "Analyse le contenu de l'appel avec l'IA et catégorise le prospect automatiquement.",
    trigger: "call_completed",
    actions: [
      { type: "ai_analyze", focus: "sentiment_and_intent" },
      { type: "update_prospect_status", logic: "based_on_ai" }
    ],
    icon: "Zap",
  }
];

// ============================================
// ONBOARDING PROGRESSIF (INFOBULLES)
// ============================================
export const ONBOARDING_STEPS = {
  DASHBOARD_WELCOME: "Bienvenue sur votre nouveau tableau de bord ! Voici un aperçu de votre activité.",
  CREATE_PROSPECT: "Commencez par ici pour ajouter votre premier client potentiel.",
  WORKFLOW_AUTOMATION: "Automatisez vos tâches répétitives en créant votre premier workflow ici.",
  SOFTPHONE_READY: "Votre téléphone est prêt. Vous pouvez passer des appels en un clic.",
};
