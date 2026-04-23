/**
 * ✅ CORRECTION PRODUCTION-READY: Normalisation des réponses pour éviter les erreurs de transformation SuperJSON
 * 
 * Ce module garantit que toutes les réponses tRPC sont correctement sérialisables
 * en normalisant les dates, les objets JSON, et en supprimant les valeurs undefined
 */

import { logger } from "../infrastructure/logger";

/**
 * Normalise une valeur pour la sérialisation SuperJSON
 */
function normalizeValue(value: any): any {
  // Null reste null
  if (value === null) return null;
  
  // Undefined devient null (SuperJSON ne gère pas undefined dans certains contextes)
  if (value === undefined) return null;
  
  // Les dates sont déjà gérées par SuperJSON, mais on s'assure qu'elles sont valides
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  
  // Les tableaux sont normalisés récursivement
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
  
  // Les objets sont normalisés récursivement
  if (typeof value === 'object' && value !== null) {
    const normalized: any= {};
    for (const [key, val] of Object.entries(value)) {
      const normalizedVal = normalizeValue(val);
      // On garde les valeurs null mais on supprime undefined
      if (normalizedVal !== undefined) {
        normalized[key] = normalizedVal;
      }
    }
    return normalized;
  }
  
  // Les autres types (string, number, boolean) passent tels quels
  return value;
}

/**
 * Normalise une réponse complète pour éviter les erreurs de transformation
 */
export function normalizeResponse<T>(data: T, context?: string): T {
  try {
    return normalizeValue(data) as T;
  } catch (error: any) {
    logger.error("[ResponseNormalizer] Failed to normalize response", {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    // En cas d'erreur, on retourne la donnée originale
    return data;
  }
}

/**
 * Normalise spécifiquement les objets JSON stockés en base de données
 * PostgreSQL retourne parfois des strings JSON qu'il faut parser
 */
export function normalizeJsonField(field: any): any {
  if (field === null || field === undefined) return null;
  
  // Si c'est déjà un objet, on le retourne tel quel
  if (typeof field === 'object') return normalizeValue(field);
  
  // Si c'est une string, on tente de la parser
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return normalizeValue(parsed);
    } catch {
      // Si le parsing échoue, c'est peut-être juste une string normale
      return field;
    }
  }
  
  return field;
}

/**
 * Normalise un enregistrement de base de données complet
 * Gère automatiquement les champs JSON et les dates
 */
export function normalizeDbRecord<T extends Record<string, any>>(record: T): T {
  if (!record) return record;
  
  const normalized: any= { ...record };
  
  // Champs JSON courants à normaliser
  const jsonFields = ['metadata', 'settings', 'config', 'actions', 'triggerConfig', 'contextSnapshot', 'changes'];
  
  for (const field of jsonFields) {
    if (field in normalized) {
      normalized[field] = normalizeJsonField(normalized[field]);
    }
  }
  
  return normalizeValue(normalized) as T;
}

/**
 * Normalise un tableau d'enregistrements de base de données
 */
export function normalizeDbRecords<T extends Record<string, any>>(records: T[]): T[] {
  if (!Array.isArray(records)) return records;
  return records.map(normalizeDbRecord);
}
