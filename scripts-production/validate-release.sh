#!/bin/bash
# ✅ FIX P1-C — Script de validation release V8
set -e
ERRORS=0

echo "════════════════════════════════════════"
echo "  SERVICALL V8 — Release Validation"
echo "════════════════════════════════════════"

check() {
  local label=$1; local cmd=$2
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  ✅ $label"
  else
    echo "  ❌ $label"
    ERRORS=$((ERRORS+1))
  fi
}

echo ""
echo "── Sécurité ──"
check ".env absent du repo"     "[ ! -f .env ]"
check "ALLOWED_ORIGINS configuré" "grep -q 'ALLOWED_ORIGINS' .env.example"
check "Pas de manus.computer"  "! grep -r 'manus.computer' server/ client/src/ 2>/dev/null | grep -v '.bak'"

echo ""
echo "── Branding V8 ──"
check "package.json name=servicall"   "grep -q '\"name\": \"servicall\"' package.json"
check "package.json version=8.0.0"    "grep -q '\"version\": \"8.0.0\"' package.json"
check "docker-compose image=v8"       "grep -q 'servicall:v8' docker-compose.yml"
check "Pas de tag V8 dans compose"    "! grep -q 'servicall:v7' docker-compose.yml"

echo ""
echo "── Syntax critique ──"
check "Pas de ); orphelins Tasks"    "! grep -P 'useTenant\(\);\n  \);' client/src/pages/Tasks.tsx"
check "Shims lib/ présents"           "[ -f client/src/lib/logger.ts ] && [ -f client/src/lib/notificationStore.ts ]"

echo ""
echo "── tRPC namespace ──"
check "TeamManager: core.teamManager"      "grep -q 'trpc.core.teamManager' client/src/pages/TeamManager.tsx"
check "WhatsApp: core.tenant"             "grep -q 'trpc.core.tenant' client/src/components/WhatsAppAgentConfig.tsx"
check "Pas de trpc.teamManager direct"    "! grep -q 'trpc\.teamManager\.' client/src/pages/TeamManager.tsx"

echo ""
echo "── Workflow dry-run ──"
check "dryRun guard dans workflowEngine"  "grep -q 'input.dryRun' server/routers/workflowEngineRouter.ts"
check "Pas de prospectId:0 dans editor"  "! grep -q 'prospectId: 0' client/src/pages/WorkflowEditor.tsx"

echo ""
echo "── DEMO_MODE feature flag ──"
check "softphoneRouter DEMO_MODE"         "grep -q 'DEMO_MODE' server/routers/softphoneRouter.ts"
check "liveListening DEMO_MODE"           "grep -q 'DEMO_MODE' server/services/liveListeningService.ts"

echo ""
echo "── Sentry conditionnel ──"
check "Sentry lit SENTRY_DSN"            "grep -q 'SENTRY_DSN' server/infrastructure/observability/sentry.ts"
check "Pas de no-op pur"                 "grep -q 'sentryInitialized' server/infrastructure/observability/sentry.ts"

echo ""
echo "── Routes workflow ──"
check "Route /workflows → WorkflowsAndAgentSwitch" \
  "grep -q 'WorkflowsAndAgentSwitch' client/src/app/App.tsx"

echo ""
echo "════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
  echo "  ✅ RELEASE VALIDATION PASSED (0 erreur)"
else
  echo "  ❌ $ERRORS ERREUR(S) — corriger avant release"
  exit 1
fi
echo "════════════════════════════════════════"
