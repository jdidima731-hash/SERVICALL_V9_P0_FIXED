/**
 * Infrastructure DB - Re-export depuis server/db.ts
 * Compatibilité pour les imports ../infrastructure/db
 */
export { db, getDbInstance, withRLS, withBootstrapContext } from "../db";
