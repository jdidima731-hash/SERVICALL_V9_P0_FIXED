/**
 * Filler Service
 * Provides contextual fillers to humanize AI interactions and mask latency.
 */

export type FillerContext = 'thinking' | 'agreeing' | 'hesitating' | 'confirming' | 'processing_data';

const FILLERS: Record<FillerContext, string[]> = {
  thinking: [
    "Hmm, laissez-moi voir...",
    "Alors...",
    "Voyons voir...",
    "Je réfléchis un instant...",
    "C'est une bonne question...",
  ],
  agreeing: [
    "Je vois.",
    "D'accord.",
    "Très bien.",
    "Entendu.",
    "Je comprends parfaitement.",
  ],
  hesitating: [
    "Euh...",
    "Hmm...",
    "Alors, attendez...",
  ],
  confirming: [
    "C'est noté.",
    "Parfait.",
    "C'est fait.",
    "C'est enregistré.",
  ],
  processing_data: [
    "Je consulte votre dossier...",
    "Je vérifie les disponibilités...",
    "Un instant, je regarde ça dans le système...",
    "Je mets à jour vos informations...",
  ]
};

/**
 * Get a random filler based on context
 */
export function getFiller(context: FillerContext = 'thinking'): string {
  const options = FILLERS[context] || FILLERS.thinking;
  return options[Math.floor(Math.random() * options.length)] ?? "Alors...";
}

/**
 * Get a random filler for general use
 */
export function getRandomFiller(): string {
  const allFillers = Object.values(FILLERS).flat();
  return allFillers[Math.floor(Math.random() * allFillers.length)] ?? "D'accord...";
}

/**
 * Get a filler based on estimated duration
 */
export function getFillerByDuration(durationMs: number): string {
  if (durationMs > 2000) return getFiller('processing_data');
  if (durationMs > 1000) return getFiller('thinking');
  if (durationMs > 500) return getFiller('hesitating');
  return "";
}
