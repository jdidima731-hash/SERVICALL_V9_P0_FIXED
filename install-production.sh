#!/usr/bin/env bash
# SERVICALL V8 — Installation de production VPS
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

info() { echo "[INFO] $*"; }
ok() { echo "[OK]   $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERR]  $*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Commande requise introuvable: $1"
}

load_env() {
  if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
}

ensure_env_file() {
  if [ ! -f .env ]; then
    if [ -f .env.production.example ]; then
      cp .env.production.example .env
      warn "Fichier .env créé depuis .env.production.example"
      warn "Complétez les secrets avant de relancer ce script."
      exit 1
    fi
    fail "Aucun fichier .env trouvé"
  fi
}

parse_database_url() {
  python3.11 - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get('DATABASE_URL', '')
if not url:
    raise SystemExit('DATABASE_URL manquante')
p = urlparse(url)
if p.scheme not in ('postgres', 'postgresql'):
    raise SystemExit('DATABASE_URL invalide')
print(p.username or '')
print(p.password or '')
print((p.hostname or 'localhost'))
print(p.port or 5432)
print((p.path or '/').lstrip('/'))
PY
}

ensure_node() {
  require_cmd node
  require_cmd npm
  require_cmd python3.11

  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt 20 ]; then
    fail "Node.js >= 20 requis"
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    info "Installation de pnpm"
    sudo npm install -g pnpm
  fi

  ok "Node.js et pnpm disponibles"
}

install_system_packages() {
  info "Mise à jour du système"
  sudo apt-get update -y

  info "Installation des paquets système"
  sudo apt-get install -y \
    postgresql postgresql-contrib postgresql-client \
    redis-server \
    ca-certificates curl git build-essential

  sudo systemctl enable postgresql >/dev/null 2>&1 || true
  sudo systemctl enable redis-server >/dev/null 2>&1 || true
  sudo systemctl restart postgresql
  sudo systemctl restart redis-server

  ok "PostgreSQL et Redis installés et démarrés"
}

ensure_database() {
  load_env
  [ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL manquante dans .env"

  mapfile -t DB_PARTS < <(parse_database_url)
  local db_user="${DB_PARTS[0]}"
  local db_pass="${DB_PARTS[1]}"
  local db_host="${DB_PARTS[2]}"
  local db_port="${DB_PARTS[3]}"
  local db_name="${DB_PARTS[4]}"

  [ -n "$db_user" ] || fail "Utilisateur PostgreSQL introuvable dans DATABASE_URL"
  [ -n "$db_name" ] || fail "Nom de base introuvable dans DATABASE_URL"

  if [ "$db_host" != "localhost" ] && [ "$db_host" != "127.0.0.1" ]; then
    warn "DATABASE_URL pointe vers $db_host:$db_port ; création locale ignorée"
    return 0
  fi

  info "Provisionnement PostgreSQL local"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$db_user'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER \"$db_user\" WITH PASSWORD '$db_pass';"

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE \"$db_name\" OWNER \"$db_user\";"

  sudo -u postgres psql -c "ALTER DATABASE \"$db_name\" OWNER TO \"$db_user\";" >/dev/null
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \"$db_name\" TO \"$db_user\";" >/dev/null

  PGPASSWORD="$db_pass" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c 'SELECT 1;' >/dev/null
  ok "Base PostgreSQL prête"
}

ensure_redis_url() {
  if [ -z "${REDIS_URL:-}" ]; then
    warn "REDIS_URL absente dans .env ; valeur locale par défaut recommandée: redis://localhost:6379"
  fi

  if [ -n "${REDIS_URL:-}" ] && command -v redis-cli >/dev/null 2>&1; then
    redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1 || warn "Redis ne répond pas encore sur REDIS_URL"
  fi
}

install_dependencies() {
  info "Installation des dépendances Node.js"
  pnpm install --frozen-lockfile || pnpm install
  ok "Dépendances installées"
}

build_project() {
  info "Build client + serveur"
  pnpm run build
  ok "Build de production terminé"
}

run_migrations() {
  info "Application des migrations"
  pnpm run db:migrate
  ok "Migrations appliquées"
}

main() {
  ensure_node
  install_system_packages
  ensure_env_file
  load_env
  ensure_database
  ensure_redis_url
  install_dependencies
  build_project
  run_migrations

  echo
  ok "Installation VPS terminée"
  echo "Étape suivante: bash start-production.sh"
}

main "$@"
