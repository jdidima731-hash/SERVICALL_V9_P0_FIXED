/**
 * =====================================================================
 * shared/types/auth.ts — SERVICALL V8
 * BLOC 1 — AUTH / TENANT : SÉPARATION STRICTE
 * =====================================================================
 *
 * CORRECTIONS APPLIQUÉES :
 *   - requireAuthenticatedUser() ne lance plus d'erreur si tenantId est absent
 *   - requireTenantScopedUser() est la fonction qui exige un tenant
 *   - Séparation claire auth ≠ tenant ≠ business logic
 * =====================================================================
 */
import type { User } from "../../drizzle/schema";

/**
 * Type étendu pour un utilisateur authentifié avec son contexte tenant
 */
export type AuthenticatedUser = User & {
  tenantId: number;
};

/**
 * Type guard pour vérifier qu'un utilisateur est authentifié avec un tenant
 */
export function isAuthenticatedUser(
  user: User | null,
  tenantId: number | null
): user is AuthenticatedUser {
  return user !== null && tenantId !== null && user.id !== null;
}

/**
 * Helper pour extraire un utilisateur authentifié depuis le contexte.
 * BLOC 1 : NE requiert PAS un tenant — uniquement l'authentification.
 * Lance une erreur si l'utilisateur est absent ou invalide.
 */
export function requireAuthenticatedUser(
  user: User | null,
  userId: number | null
): User & { id: number } {
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }
  if (!userId || userId <= 0) {
    throw new Error("User ID manquant ou invalide dans la session");
  }
  return { ...user, id: userId };
}

/**
 * Helper pour extraire un utilisateur authentifié avec un tenant actif.
 * BLOC 1 : Requiert un tenant valide (tenantId > 0).
 * Un superadmin (tenantId === -1) doit utiliser une procédure dédiée.
 * Lance une erreur si l'utilisateur, le userId ou le tenantId est absent/invalide.
 */
export function requireTenantScopedUser(
  user: User | null,
  userId: number | null,
  tenantId: number | null
): AuthenticatedUser {
  if (!user) {
    throw new Error("Utilisateur non authentifié");
  }
  if (!userId || userId <= 0) {
    throw new Error("User ID manquant dans la session");
  }
  if (!tenantId || tenantId <= 0) {
    throw new Error(
      "Tenant ID manquant ou invalide. " +
      "Votre compte n'est associé à aucune organisation active."
    );
  }
  return {
    ...user,
    tenantId,
  };
}
