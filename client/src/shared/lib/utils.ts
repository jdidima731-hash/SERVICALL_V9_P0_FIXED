import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Fonction de rendu sécurisée pour éviter l'erreur React #31
 * Garantit que n'importe quel type de donnée est converti en chaîne sûre.
 */
export function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  
  // Sécurité contre les objets React (icônes, composants)
  if (typeof value === "object") {
    if ((value as any).$$typeof || (value as any).render || (value as any).displayName) {
      return "";
    }
    try {
      return JSON.stringify(value);
    } catch (e: any) {
      return "";
    }
  }
  
  return String(value);
}
