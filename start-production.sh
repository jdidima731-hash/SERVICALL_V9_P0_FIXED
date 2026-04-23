#!/usr/bin/env bash
# SERVICALL V8 — Démarrage de production VPS
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

info() { echo "[INFO] $*"; }
ok() { echo "[OK]   $*"; }
fail() { echo "[ERR]  $*"; exit 1; }

[ -f .env ] || fail "Fichier .env manquant. Copiez .env.production.example vers .env et configurez-le."

set -a
# shellcheck disable=SC1091
source .env
set +a

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL manquante"
[ -n "${REDIS_URL:-}" ] || fail "REDIS_URL manquante"

mkdir -p logs dist/public

info "Démarrage des services système"
sudo systemctl restart postgresql >/dev/null 2>&1 || sudo service postgresql restart >/dev/null 2>&1 || true
sudo systemctl restart redis-server >/dev/null 2>&1 || sudo service redis-server restart >/dev/null 2>&1 || true

info "Vérification PostgreSQL"
pg_isready -d "$DATABASE_URL" >/dev/null 2>&1 || fail "PostgreSQL inaccessible via DATABASE_URL"
ok "PostgreSQL OK"

info "Vérification Redis"
redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1 || fail "Redis inaccessible via REDIS_URL"
ok "Redis OK"

if [ ! -f dist/index.js ]; then
  info "Build absent, compilation automatique"
  pnpm run build
fi

info "Exécution des migrations automatiques"
pnpm run db:migrate
ok "Schéma base de données synchronisé"

info "Lancement du serveur"
exec env NODE_ENV=production node dist/index.js
