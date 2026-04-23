/**
 * =====================================================================
 * BLOC 0 — FREEZE GLOBAL (STABILISATION OBLIGATOIRE)
 * =====================================================================
 * Bloque toute dérive pendant la correction structurelle.
 *
 * INTERDIT en mode freeze :
 *   - création de nouveaux workflows
 *   - duplication de workflows
 *   - import de blueprints non validés
 *   - ajout d'actions ou triggers UI
 *   - modification des catalogues métiers
 *
 * AUTORISÉ en mode freeze :
 *   - lecture (list, getById, getExecutions)
 *   - exécution existante (testRun sur workflow existant)
 *   - debug / logs
 *
 * Pour désactiver le freeze : passer SYSTEM_FREEZE=false dans l'env.
 * =====================================================================
 */

import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

/**
 * Indique si le système est en mode freeze.
 * Contrôlé par la variable d'environnement SYSTEM_FREEZE.
 * Par défaut : false (pas de freeze en prod sauf activation explicite).
 */
export const SYSTEM_FREEZE: boolean =
  process.env["SYSTEM_FREEZE"] === "true";

/**
 * Liste des opérations interdites en mode freeze.
 * Ces identifiants correspondent aux noms des mutations tRPC concernées.
 */
export const FREEZE_BLOCKED_OPERATIONS = [
  "workflowBuilder.save",       // création / mise à jour de workflow
  "workflowBuilder.duplicate",  // duplication
  "workflowBuilder.delete",     // suppression
  "industry.importBlueprint",   // import blueprint non validé
  "industry.updateCatalog",     // modification catalogue métier
] as const;

export type FreezeBlockedOperation = typeof FREEZE_BLOCKED_OPERATIONS[number];

/**
 * Middleware tRPC : rejette les opérations de mutation interdites
 * lorsque le système est en mode freeze.
 *
 * Usage :
 *   import { freezeGuard } from '../_core/freeze';
 *   const myProcedure = managerProcedure.use(freezeGuard);
 */
export function assertNotFrozen(operationLabel: string): void {
  if (SYSTEM_FREEZE) {
    logger.warn("[FREEZE] Opération bloquée — système en mode lecture seule", {
      operation: operationLabel,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Le système est actuellement en mode lecture seule (FREEZE actif). " +
        "Création, duplication et import sont temporairement désactivés.",
    });
  }
}

/**
 * Helper pour les routes qui doivent respecter le freeze.
 * Appeler en début de mutation :
 *   assertNotFrozen('workflowBuilder.save');
 */
export { assertNotFrozen as checkFreeze };
