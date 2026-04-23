#!/bin/bash
# ============================================================
# SERVICALL V8 — Installation & démarrage production
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Servicall V8 — setup & start"

# 1. .env obligatoire
if [ ! -f ".env" ]; then
  echo "❌ Fichier .env absent."
  echo "   Copiez .env.example en .env et remplissez toutes les variables."
  exit 1
fi
export $(grep -v '^#' .env | xargs)
echo "[✓] Environnement chargé"

# 2. Variables requises
REQUIRED_VARS=(DATABASE_URL REDIS_URL JWT_SECRET JWT_REFRESH_SECRET TENANT_JWT_SECRET ENCRYPTION_KEY ENCRYPTION_SALT SESSION_SECRET CSRF_SECRET MASTER_KEY COOKIE_SECRET ADMIN_EMAIL ADMIN_PASSWORD)
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo "❌ Variable manquante : $VAR"
    exit 1
  fi
done
echo "[✓] Variables d'environnement validées"

# 3. Services — tenter le démarrage, mais échouer si toujours indisponible après
echo "[...] Vérification PostgreSQL et Redis..."
sudo service postgresql start 2>/dev/null || true
sudo service redis-server start 2>/dev/null || true
sleep 3

# 4. DB check
PGPASSWORD="${PGPASSWORD:-}" psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1 || {
  echo "❌ Impossible de se connecter à PostgreSQL via DATABASE_URL"
  exit 1
}
echo "[✓] PostgreSQL connecté"

redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1 || {
  echo "❌ Redis non disponible"
  exit 1
}
echo "[✓] Redis connecté"

# 5. Dépendances
if [ ! -d "node_modules" ]; then
  echo "[...] Installation des dépendances..."
  pnpm install --frozen-lockfile
fi

# 6. Migrations
echo "[...] Application des migrations Drizzle..."
pnpm run db:migrate
echo "[✓] Migrations OK"

# 6b. RLS HARDENING CANONICAL — aucun BYPASSRLS requis
# La migration 0002_rls_hardening_canonical.sql gere l'isolation RLS stricte.
# getUserTenants() utilise SET LOCAL app.user_id (bootstrap context) — pas de BYPASSRLS.
# Aucun script legacy RLS (apply-rls, enable-rls, auto-migrate-rls) ne doit etre execute.
echo "[✓] RLS hardening canonical — aucun BYPASSRLS global requis"

# 7. Build
# ⚠️ Toujours rebuilder en production — ne pas réutiliser un dist/ stale.
# Un build stale avec un code mis à jour = bugs silencieux impossibles à diagnostiquer.
echo "[...] Build production (Vite + esbuild)..."
NODE_ENV=production pnpm run build
echo "[✓] Build terminé"

# 8. Démarrage
echo ""
echo "========================================"
echo "✅ SERVICALL V8 PRÊT"
echo "URL : http://localhost:${PORT:-5000}"
echo "========================================"
NODE_ENV=production node dist/index.js
