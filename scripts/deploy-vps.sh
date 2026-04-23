#!/usr/bin/env bash
# SERVICALL V8 — Déploiement VPS unifié
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

info() { echo "[INFO] $*"; }
ok() { echo "[OK]   $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERR]  $*"; exit 1; }

chmod +x install-production.sh start-production.sh

info "Installation / mise à niveau de l’environnement VPS"
bash ./install-production.sh

if command -v pm2 >/dev/null 2>&1; then
  info "Déploiement via PM2"
  mkdir -p logs
  pm2 delete servicall >/dev/null 2>&1 || true
  pm2 start ecosystem.config.cjs --env production
  pm2 save >/dev/null 2>&1 || true
  ok "Application démarrée avec PM2"
else
  warn "PM2 non installé. Lancement direct recommandé uniquement pour validation manuelle."
  warn "Commande: bash ./start-production.sh"
fi
