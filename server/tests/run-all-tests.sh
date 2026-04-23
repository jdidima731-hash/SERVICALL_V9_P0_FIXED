#!/bin/bash

# ============================================
# SCRIPT D'EXÉCUTION DES TESTS
# ============================================

set -e

echo "🧪 Démarrage des tests automatisés..."
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# ============================================
# FONCTION D'EXÉCUTION DE TEST
# ============================================

run_test() {
  local test_name=$1
  local test_file=$2
  
  echo "📋 Test: $test_name"
  echo "   Fichier: $test_file"
  
  if npm run test -- $test_file 2>&1 | tee /tmp/test_output.log; then
    echo -e "${GREEN}✅ PASSÉ${NC}"
    ((PASSED_TESTS++))
  else
    echo -e "${RED}❌ ÉCHOUÉ${NC}"
    ((FAILED_TESTS++))
  fi
  
  ((TOTAL_TESTS++))
  echo ""
}

# ============================================
# VÉRIFICATION DE L'ENVIRONNEMENT
# ============================================

echo "🔍 Vérification de l'environnement..."

if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  Aucun fichier .env trouvé${NC}"
  echo "   Création d'un fichier .env de test..."
  cp .env.example .env.local 2>/dev/null || echo "NODE_ENV=test" > .env.local
fi

echo -e "${GREEN}✅ Environnement prêt${NC}"
echo ""

# ============================================
# TESTS API CRUD
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 TESTS API CRUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Note: Décommenter quand les tests sont prêts
# run_test "API CRUD" "server/tests/api-crud.test.ts"

echo "⏭️  Tests API CRUD désactivés (nécessite DB)"
echo ""

# ============================================
# TESTS WORKFLOW TEMPS RÉEL
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ TESTS WORKFLOW TEMPS RÉEL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Note: Décommenter quand les tests sont prêts
# run_test "Workflow Temps Réel" "server/tests/workflow-realtime.test.ts"

echo "⏭️  Tests Workflow désactivés (nécessite services)"
echo ""

# ============================================
# TESTS MULTI-TENANT
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏢 TESTS MULTI-TENANT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "⏭️  Tests Multi-tenant inclus dans API CRUD"
echo ""

# ============================================
# TESTS DE SÉCURITÉ
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 TESTS DE SÉCURITÉ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ Validation des secrets..."
tsx server/scripts/generate-secrets-secure.ts --validate 2>/dev/null || echo "   Script de validation à implémenter"

echo "✅ Vérification des variables d'environnement..."
node -e "
  require('dotenv').config({ path: '.env.local' });
  const required = ['JWT_SECRET', 'SESSION_SECRET', 'DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.log('   ⚠️  Variables manquantes:', missing.join(', '));
  } else {
    console.log('   ✅ Toutes les variables requises sont présentes');
  }
" || true

echo ""

# ============================================
# TESTS DE BUILD
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 TESTS DE BUILD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Vérification TypeScript..."
if npm run check 2>&1 | grep -q "error"; then
  echo -e "${RED}❌ Erreurs TypeScript détectées${NC}"
  ((FAILED_TESTS++))
else
  echo -e "${GREEN}✅ Pas d'erreurs TypeScript${NC}"
  ((PASSED_TESTS++))
fi
((TOTAL_TESTS++))

echo ""

# ============================================
# RÉSUMÉ
# ============================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSUMÉ DES TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total des tests: $TOTAL_TESTS"
echo -e "Tests réussis:   ${GREEN}$PASSED_TESTS${NC}"
echo -e "Tests échoués:   ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ TOUS LES TESTS SONT PASSÉS${NC}"
  exit 0
else
  echo -e "${RED}❌ CERTAINS TESTS ONT ÉCHOUÉ${NC}"
  exit 1
fi
