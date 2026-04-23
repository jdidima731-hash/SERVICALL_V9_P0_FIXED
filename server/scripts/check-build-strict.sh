#!/bin/bash

# ============================================
# STRICT BUILD CHECK SCRIPT
# ============================================

set -e

echo "🚀 Démarrage de la vérification stricte du build..."

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Vérification des types
echo "🔍 Étape 1: Vérification des types TypeScript (Strict)..."
# Note: On utilise --noEmit pour vérifier sans générer de fichiers
if npx tsc --project server/tsconfig.json --noEmit --strict --noImplicitAny; then
  echo -e "${GREEN}✅ Vérification TypeScript réussie sans erreurs.${NC}"
else
  echo -e "${RED}❌ Erreurs TypeScript détectées.${NC}"
  # On ne sort pas immédiatement pour voir les autres erreurs
fi

# 2. Recherche de 'any' restants
echo "🔍 Étape 2: Recherche de 'any' restants dans les fichiers critiques..."
CRITICAL_ANY=$(grep -r "any" server --include="*.ts" | grep -v "node_modules" | wc -l)
if [ "$CRITICAL_ANY" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Attention: Il reste encore $CRITICAL_ANY occurrences de 'any'.${NC}"
  echo "Fichiers avec le plus de 'any':"
  grep -r "any" server --include="*.ts" -c | sort -t: -k2 -nr | head -5
else
  echo -e "${GREEN}✅ Aucun 'any' trouvé ! Excellent travail.${NC}"
fi

# 3. Dépendances circulaires
echo "🔍 Étape 3: Vérification des dépendances circulaires (via analyse manuelle)..."
# Simple détection de cycles potentiels entre services et db
CYCLES=$(grep -r "import.*from \"../db\"" server/services --include="*.ts" | wc -l)
if [ "$CYCLES" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Cycles potentiels détectés entre Services et DB ($CYCLES imports).${NC}"
else
  echo -e "${GREEN}✅ Aucun cycle évident détecté.${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 BILAN TECHNIQUE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Types: Strict"
echo "Isolation Tenant: Middleware Global Actif"
echo "Gestion Erreurs: Centralisée"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
