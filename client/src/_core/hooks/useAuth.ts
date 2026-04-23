/**
 * COMPATIBILITÉ : re-export depuis l'emplacement FSD canonique
 * Évite d'avoir deux instances de useAuth avec des états différents.
 */
export { useAuth } from "@/entities/user/model/useAuth";
