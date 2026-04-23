/**
 * reset-admin-password.ts
 * ─────────────────────────────────────────────────────────────────
 * Remet à zéro le password_hash d'un admin avec un hash bcrypt propre.
 * 
 * USAGE (depuis la racine du projet) :
 *   ADMIN_EMAIL=${process.env.ADMIN_EMAIL || "REQUIRED_ADMIN_EMAIL"} \
 *   ADMIN_PASSWORD=MonNouveauMdp2024! \
 *   npx tsx server/scripts/reset-admin-password.ts
 *
 * Variables requises :
 *   ADMIN_EMAIL     — email de l'utilisateur à réinitialiser
 *   ADMIN_PASSWORD  — nouveau mot de passe (min 8 chars)
 *
 * Ce script :
 *   1. Se connecte à PostgreSQL via DATABASE_URL
 *   2. Vérifie que l'utilisateur existe
 *   3. Génère un hash bcrypt (12 rounds) propre
 *   4. Met à jour password_hash en base
 *   5. Quitte proprement
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import postgres from "postgres";

const ADMIN_EMAIL    = process.env["ADMIN_EMAIL"];
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"];
const DATABASE_URL   = process.env["DATABASE_URL"];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !DATABASE_URL) {
  console.error("❌ Variables requises manquantes : ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL");
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 8) {
  console.error("❌ ADMIN_PASSWORD doit contenir au moins 8 caractères");
  process.exit(1);
}

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    // 1. Vérifier que l'utilisateur existe
    const rows = await sql`
      SELECT id, email, role FROM users WHERE email = ${ADMIN_EMAIL!} LIMIT 1
    `;

    if (rows.length === 0) {
      console.error(`❌ Aucun utilisateur trouvé avec l'email : ${ADMIN_EMAIL}`);
      process.exit(1);
    }

    const user = rows[0];
    console.log(`✅ Utilisateur trouvé : id=${user.id} email=${user.email} role=${user.role}`);

    // 2. Générer un hash bcrypt propre (12 rounds — même valeur que passwordService.ts)
    console.log("⏳ Génération du hash bcrypt (12 rounds)...");
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD!, 12);

    // 3. Mettre à jour en base
    await sql`
      UPDATE users
      SET    password_hash = ${passwordHash},
             updated_at    = NOW()
      WHERE  email = ${ADMIN_EMAIL!}
    `;

    console.log(`✅ Mot de passe réinitialisé avec succès pour ${ADMIN_EMAIL}`);
    console.log(`   Hash bcrypt généré : ${passwordHash.substring(0, 20)}...`);
    console.log(`\n   Vous pouvez maintenant vous connecter avec :`);
    console.log(`   Email    : ${ADMIN_EMAIL}`);
    console.log(`   Password : ${ADMIN_PASSWORD}`);

  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
