/**
 * =====================================================================
 * VERIFY RLS HARDENING CANONICAL
 * =====================================================================
 * Script de vérification post-migration pour garantir que le RLS
 * est correctement appliqué et fail-closed sur toutes les tables.
 * =====================================================================
 */
import "dotenv/config";
import postgres from "postgres";
import { logger } from "../infrastructure/logger";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error("❌ DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function verifyRLS() {
  logger.info("🔍 Démarrage de la vérification RLS Hardening Canonical...");

  try {
    // 1. Vérifier que les fonctions strictes existent
    const funcs = await sql`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('app_require_tenant_id', 'app_require_user_id');
    `;
    
    if (funcs.length < 2) {
      logger.error("❌ Fonctions RLS strictes manquantes (app_require_tenant_id, app_require_user_id)");
      process.exit(1);
    }
    logger.info("✅ Fonctions RLS strictes présentes");

    // 2. Vérifier les tables avec tenant_id
    const tenantTables = await sql`
      SELECT c.table_name
      FROM information_schema.columns c
      WHERE c.column_name = 'tenant_id'
        AND c.table_schema = 'public'
        AND c.table_name NOT IN ('tenants', 'users', 'tenant_users')
    `;

    let allValid = true;

    for (const row of tenantTables) {
      const tableName = row.table_name;
      
      // Vérifier si RLS est activé
      const rlsStatus = await sql`
        SELECT relrowsecurity, relforcerowsecurity 
        FROM pg_class 
        WHERE relname = ${tableName};
      `;

      if (!rlsStatus[0]?.relrowsecurity || !rlsStatus[0]?.relforcerowsecurity) {
        logger.error(`❌ RLS non activé ou non forcé sur la table: ${tableName}`);
        allValid = false;
        continue;
      }

      // Vérifier la politique
      const policies = await sql`
        SELECT policyname, permissive, qual 
        FROM pg_policies 
        WHERE tablename = ${tableName};
      `;

      const hasCanonicalPolicy = policies.some(p => 
        p.policyname === 'tenant_isolation_canonical' && 
        p.permissive === 'RESTRICTIVE' &&
        p.qual.includes('app_require_tenant_id()')
      );

      if (!hasCanonicalPolicy) {
        logger.error(`❌ Politique canonique manquante ou incorrecte sur la table: ${tableName}`);
        allValid = false;
      }
    }

    // 3. Vérifier tenant_users et users
      const specialTables = [
        { name: 'tenant_users', policy: 'tenant_users_isolation', qual: 'user_id = app_require_user_id()' },
        { name: 'users', policy: 'users_isolation', qual: 'id = app_require_user_id()' }
      ];
    for (const table of specialTables) {
      const tableName = table.name;
      const policyName = table.policy;
      const policyQual = table.qual;
      const rlsStatus = await sql`
        SELECT relrowsecurity, relforcerowsecurity 
        FROM pg_class 
        WHERE relname = ${tableName};
      `;

      if (!rlsStatus[0]?.relrowsecurity || !rlsStatus[0]?.relforcerowsecurity) {
        logger.error(`❌ RLS non activé ou non forcé sur la table spéciale: ${tableName}`);
        allValid = false;
        continue;
      }

      const policies = await sql`
        SELECT policyname, permissive, qual 
        FROM pg_policies 
        WHERE tablename = ${tableName};
      `;

      const hasCanonicalPolicy = policies.some(p => 
        p.policyname === policyName && 
        p.permissive === 'RESTRICTIVE' &&
        p.qual.includes(policyQual)
      );

      if (!hasCanonicalPolicy) {
        logger.error(`❌ Politique canonique manquante ou incorrecte sur la table spéciale: ${tableName}`);
        allValid = false;
      }
    }

    if (allValid) {
      logger.info("🎉 SUCCESS: RLS Hardening Canonical est 100% valide et fail-closed.");
    } else {
      logger.error("❌ FAILURE: Des failles RLS ont été détectées.");
      process.exit(1);
    }

  } catch (error) {
    logger.error("❌ Erreur lors de la vérification RLS:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyRLS();
