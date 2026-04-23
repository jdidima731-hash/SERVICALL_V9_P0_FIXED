/**
 * Password Service
 * Handles password hashing and verification using bcrypt
 * [CORRIGÉ] Utilisation exclusive de bcrypt pour une sécurité maximale
 */

import { logger } from "../infrastructure/logger";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error("Le mot de passe ne peut pas être vide");
  }

  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères");
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    logger.debug("[PasswordService] Mot de passe haché avec bcrypt");
    return hash;
  } catch (error: any) {
    logger.error("[PasswordService] Erreur lors du hachage du mot de passe", { error });
    throw new Error("Échec du hachage du mot de passe");
  }
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    // On ne supporte plus les anciens formats de hash non-bcrypt
    if (hash.includes(":")) {
      logger.warn("[PasswordService] Tentative de vérification avec un ancien format de hash (pbkdf2). Rejeté.");
      return false;
    }

    const isValid = await bcrypt.compare(password, hash);
    logger.debug("[PasswordService] Vérification du mot de passe terminée", { isValid });
    return isValid;
  } catch (error: any) {
    logger.error("[PasswordService] Erreur lors de la vérification du mot de passe", { error });
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Le mot de passe doit contenir au moins 8 caractères");
  }

  if (password.length > 128) {
    errors.push("Le mot de passe ne doit pas dépasser 128 caractères");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une lettre minuscule");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une lettre majuscule");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un chiffre");
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un caractère spécial");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
