/**
 * MAPPING DES CAPACITÉS
 * Associe chaque ID technique à un label en français lisible.
 */

const CAPABILITY_LABELS: Record<string, string> = {
  // Télécom & Général
  call_qualification: "Qualification d'appels",
  appointment_booking: "Prise de rendez-vous",
  customer_support: "Support client",
  
  // Assurance
  claim_processing: "Gestion des sinistres",
  policy_inquiry: "Demande de contrat",
  
  // Immobilier
  property_inquiry: "Demande d'information bien",
  visit_scheduling: "Planification de visites",
  lead_qualification: "Qualification de prospects",
  
  // Santé
  patient_intake: "Accueil patient",
  prescription_renewal: "Renouvellement d'ordonnance",
  
  // Générique & Autres
  call_handling: "Gestion des appels",
  message_taking: "Prise de messages",
  basic_qualification: "Qualification de base",
  whatsapp_integration: "Intégration WhatsApp",
  sms_notifications: "Notifications SMS",
  calendar_sync: "Synchronisation Calendrier"
};

/**
 * Retourne le label lisible pour une capacité donnée
 * @param capabilityId L'identifiant technique de la capacité
 * @returns Le label en français ou l'ID si non trouvé
 */
export function getCapabilityLabel(capabilityId: string): string {
  return CAPABILITY_LABELS[capabilityId] || capabilityId;
}

export default CAPABILITY_LABELS;
