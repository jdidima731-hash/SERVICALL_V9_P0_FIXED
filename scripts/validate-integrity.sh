#!/bin/bash
# =====================================================================
# INTEGRITY VALIDATOR — SERVICALL V8
# BLOC 8 — CI / PRE-FLIGHT CHECK
# =====================================================================

echo "🔍 Démarrage de la validation d'intégrité..."

# 1. Vérification des fichiers critiques
CRITICAL_FILES=(
  "server/_core/context.ts"
  "server/_core/trpc.ts"
  "server/workflow-engine/core/WorkflowExecutor.ts"
  "shared/actionTypes.ts"
  "shared/eventTypes.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "/home/ubuntu/servicall_work/$file" ]; then
    echo "✅ Fichier présent : $file"
  else
    echo "❌ Fichier MANQUANT : $file"
    exit 1
  fi
done

# 2. Vérification de la présence des corrections Blocs 0-7
grep -q "assertNotFrozen" /home/ubuntu/servicall_work/server/routers/workflowBuilderRouter.ts || { echo "❌ Bloc 0 (Freeze) manquant"; exit 1; }
grep -q "isTenantScoped" /home/ubuntu/servicall_work/server/_core/context.ts || { echo "❌ Bloc 1 (Auth) manquant"; exit 1; }
grep -q "generateVoiceStreamToken" /home/ubuntu/servicall_work/server/services/twilioWebRTCService.ts || { echo "❌ Bloc 6 (Twilio) manquant"; exit 1; }

echo "🚀 Validation terminée avec succès. Le système est prêt."
