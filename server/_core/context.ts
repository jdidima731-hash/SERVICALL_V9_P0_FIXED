/**
 * =====================================================================
 * TRPC CONTEXT — SERVICALL V8
 * BLOC 1 — AUTH / TENANT : SÉPARATION STRICTE DES 4 ÉTATS
 * =====================================================================
 *
 * MODÈLE CANONIQUE FINAL (4 états exclusifs) :
 *
 *   État              | Condition
 *   ──────────────────|──────────────────────────────────────────────
 *   NON AUTH          | user = null
 *   AUTH SANS TENANT  | user != null && tenantId = null
 *   TENANT ACTIF      | tenantId > 0
 *   SUPERADMIN        | tenantId = -1
 *
 * RÈGLES :
 *  - tenantId est conservé brut depuis le JWT (jamais normalisé en null automatiquement)
 *  - tenantId === -1 → superadmin global (préservé tel quel)
 *  - tenantId > 0    → tenant actif normal
 *  - tenantId = null → user authentifié sans tenant
 *  - Les headers HTTP client sont ignorés (prévention d'usurpation)
 *  - Le contexte RLS réel est injecté via SET LOCAL dans la transaction
 *
 * INTERDIT :
 *  - utiliser tenantId comme condition implicite de sécurité
 *  - fallback null automatique destructif (tenantId > 0 ? id : null)
 * =====================================================================
 */
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { AuthService, AuthenticatedUser } from "../services/authService";
import { type TenantPayload } from "../services/tenantService";
import type { DbTransaction } from "../db";

// ─── Types publics du contexte ────────────────────────────────────────────────

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  userId: number | null;
  tenantId: number | null;
  tenantContext: TenantPayload | null;
  /** BLOC 1 — Flags d'état auth canoniques */
  isAuthenticated: boolean;
  hasTenant: boolean;
  isSuperAdmin: boolean;
  tenantRole?: string | null;
};

/**
 * Contexte protégé : user garanti non-null.
 * NE garantit PAS un tenant — utiliser TenantTrpcContext pour ça.
 */
export type ProtectedTrpcContext = Omit<TrpcContext, 'user' | 'userId'> & {
  user: AuthenticatedUser;
  userId: number;
};

/**
 * Contexte tenant : user, userId et tenantId garantis non-null et valides.
 * tenantId > 0 OU tenantId === -1 (superadmin).
 */
export type TenantTrpcContext = Omit<
  TrpcContext,
  'user' | 'userId' | 'tenantId' | 'tenantContext'
> & {
  user: AuthenticatedUser;
  userId: number;
  tenantId: number;
  tenantContext: TenantPayload;
};

/**
 * Contexte DB tenant-scopé injecté par RLS dans la transaction courante.
 * Ce type est utilisé par tenantProcedure pour imposer ctx.db côté compilation.
 */
export type TenantDbContext = DbTransaction;

/**
 * Contexte tenant enrichi avec le handle DB transactionnel RLS-scopé.
 */
export type TenantDbTrpcContext = TenantTrpcContext & {
  db: TenantDbContext;
};

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Normalise le rôle vers les valeurs acceptées par TenantPayload.
 * superadmin → 'admin' pour le contexte tenant (accès maximal).
 */
function normalizeRole(
  role: AuthenticatedUser['role'] | string
): TenantPayload['role'] {
  if (role === 'admin' || role === 'owner' || role === 'superadmin') return 'admin';
  if (role === 'manager') return 'manager';
  return 'agent'; // viewer, agent → agent
}

// ─── Création du contexte tRPC ────────────────────────────────────────────────

/**
 * Création de contexte tRPC avec authentification via JWT (cookie de session).
 *
 * BLOC 1 — Dérivation explicite des flags d'état :
 *   isAuthenticated = user != null && userId != null
 *   isSuperAdmin    = tenantId === -1
 *   hasTenant       = tenantId > 0
 *
 * tenantContext est construit UNIQUEMENT si hasTenant === true.
 * Un superadmin (tenantId === -1) n'a pas de tenantContext par défaut ;
 * il reçoit un contexte dédié dans requireTenantContext si nécessaire.
 */
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let authenticatedUser: AuthenticatedUser | null = null;
  let tenantId: number | null = null;
  let userId: number | null = null;

  try {
    const authResult = await AuthService.authenticateRequest(opts.req);
    if (authResult) {
      authenticatedUser = authResult.user;

      // BLOC 1 — Conservation brute du tenantId depuis le JWT
      // JAMAIS normalisé automatiquement en null (sauf si vraiment absent/invalide)
      // tenantId === -1 → superadmin global (préservé tel quel)
      // tenantId > 0    → tenant actif (préservé tel quel)
      // tenantId === 0 ou NaN → pas de tenant (null)
      tenantId = Number.isInteger(authResult.tenantId)
        ? authResult.tenantId
        : null;
      // Si tenantId === 0 (valeur invalide, non -1 et non > 0) → null
      if (tenantId === 0) tenantId = null;

      // userId doit être un entier positif valide
      userId =
        authenticatedUser.id > 0 ? authenticatedUser.id : null;
    }
  } catch (_error) {
    // L'authentification est optionnelle pour les procédures publiques
    authenticatedUser = null;
    tenantId = null;
    userId = null;
  }

  // ─── Dérivation explicite des 4 états canoniques ──────────────────────────
  const isAuthenticated: boolean =
    authenticatedUser !== null && userId !== null;

  const isSuperAdmin: boolean = tenantId === -1;

  const hasTenant: boolean =
    typeof tenantId === "number" && tenantId > 0;

  // ─── tenantContext : construit UNIQUEMENT si hasTenant === true ───────────
  // Un superadmin (isSuperAdmin) n'a pas de tenantContext ici ;
  // il sera géré dans requireTenantContext avec un target tenant explicite.
  const tenantContext: TenantPayload | null =
    isAuthenticated && hasTenant && authenticatedUser && userId
      ? {
          tenantId: tenantId as number,
          role: normalizeRole(authenticatedUser.role),
          userId: userId,
          issuedAt: Date.now(),
        }
      : null;

  return {
    req: opts.req,
    res: opts.res,
    user: authenticatedUser,
    userId,
    tenantId,
    tenantContext,
    isAuthenticated,
    hasTenant,
    isSuperAdmin,
  };
}
