#!/bin/bash
# ✅ CORRECTION BUG BUILD: Script de build propre
# Nettoie le répertoire dist avant de rebuilder pour éviter les caches obsolètes
# Problème: Vite/esbuild utilisait parfois l'ancien build sans prendre en compte les corrections

set -e

echo "🧹 Nettoyage du build précédent..."
rm -rf dist
rm -rf .tsbuildinfo
echo "✅ Build précédent supprimé"

echo "🔨 Compilation TypeScript + Vite..."
NODE_OPTIONS='--max-old-space-size=8192' pnpm run build

echo "✅ Build terminé avec succès"
echo "📁 Contenu du répertoire dist:"
ls -la dist/
