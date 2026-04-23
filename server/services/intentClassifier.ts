export type SimpleIntent = 'transfer_human' | 'book_appointment' | 'stop' | 'ask_price' | null;

const intentPatterns = {
  transfer_human: /parler à un humain|passer un conseiller|parler à quelqu'un|agent humain|vrai personne|conseiller|opérateur|humain/i,
  book_appointment: /prendre rendez-vous|prendre rdv|réserver un créneau|fixer un rendez-vous|disponibilité|rendez-vous|rdv/i,
  stop: /stop|arrêter|raccrocher|ne m'appelez plus|quitter|finir|terminer/i,
  ask_price: /combien ça coûte|quel est le prix|tarif|prix|coût|payant/i
};

/**
 * NLU Rapide : Pré-classifieur d'intentions léger pour les intents critiques
 * @param transcript Le texte transcrit
 * @returns L'intention détectée ou null
 */
export function detectSimpleIntent(transcript: string): SimpleIntent {
  const text = transcript.toLowerCase();
  
  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    if (pattern.test(text)) {
      return intent as SimpleIntent;
    }
  }
  
  return null;
}
