#!/bin/bash
# ============================================================
# SERVICALL - Script de démarrage production
# ============================================================
set -e  # exit on first error — no silent failures

echo "🚀 Démarrage SERVICALL..."

# Vérifier que .env existe
if [ ! -f ".env" ]; then
  echo "❌ Fichier .env manquant. Copiez .env.example en .env et configurez-le."
  exit 1
fi

# Charger les variables d'environnement
export $(cat .env | grep -v '^#' | xargs)

# Vérifier PostgreSQL — OBLIGATOIRE
echo "📦 Vérification de PostgreSQL..."
if ! pg_isready -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER:-servicall}" 2>/dev/null; then
  echo "⚠️  PostgreSQL non disponible. Tentative de démarrage..."
  sudo service postgresql start
  sleep 3
  if ! pg_isready -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "${DB_USER:-servicall}" 2>/dev/null; then
    echo "❌ PostgreSQL inaccessible après tentative. Arrêt."
    exit 1
  fi
fi
echo "✅ PostgreSQL disponible"

# Vérifier Redis — OBLIGATOIRE en production
echo "📦 Vérification de Redis..."
if ! redis-cli ping > /dev/null 2>&1; then
  echo "⚠️  Redis non disponible. Tentative de démarrage..."
  sudo service redis-server start
  sleep 2
  if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis inaccessible après tentative. Arrêt."
    exit 1
  fi
fi
echo "✅ Redis disponible"

# Exécuter les migrations — OBLIGATOIRE, tout échec arrête le démarrage
echo "🔄 Exécution des migrations..."
pnpm run db:migrate
echo "✅ Migrations terminées"

# Démarrer le serveur
echo "✅ Démarrage du serveur sur le port ${PORT:-3000}..."
node dist/index.js
