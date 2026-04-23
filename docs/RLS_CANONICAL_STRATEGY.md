# 🚀 SERVICALL V8 — RLS HARDENING CANONICAL STRATEGY

## 🎯 OBJECTIF GLOBAL
Ce document décrit l'architecture canonique de Row Level Security (RLS) implémentée dans SERVICALL V8.
L'objectif est de garantir une isolation stricte inter-tenant (zéro fuite possible), un seul chemin de vérité RLS (fail-closed), et une exécution déterministe des migrations.

## ⚠️ CONTRAINTES ABSOLUES (NON NÉGOCIABLES)
- ❌ Aucun `set_config('app.tenant_id', ...)` permissif ou vide
- ❌ Aucun `current_setting(..., true)` utilisé pour fallback silencieux
- ❌ Aucun `NULLIF`, fallback implicite ou contournement RLS
- ❌ Aucun double système RLS (ancien + nouveau)
- ❌ Aucun accès cross-tenant possible même indirectement
- ❌ Aucun script legacy RLS actif (`apply-rls.ts`, `enable-rls.sql`, etc.)
- ❌ Aucun rôle PostgreSQL bypass utilisé en prod

## 🧠 ARCHITECTURE CANONIQUE (OBLIGATOIRE)

### Flux officiel
1. **User authentifié**
2. → injection `app.user_id` (transaction-scoped)
3. → `getUserTenants()` (RLS strict sur `tenant_users`)
4. → sélection tenant actif
5. → signature cookie tenant
6. → requêtes métier avec `app.user_id` + `app.tenant_id`
7. → même connexion transactionnelle (`SET LOCAL` sécurisé)

## 🔐 RÈGLE CRITIQUE
👉 `app.user_id` + `app.tenant_id` doivent être injectés dans la **même transaction DB**.

⚠️ **Interdiction :**
- injection globale sur pool
- persistance inter-requêtes
- dépendance connexion partagée sans scope

## 🗄️ MIGRATIONS
L'ordre strict des migrations est :
1. `0000_initial_complete_migration.sql` (Base initiale nettoyée)
2. `0001_add_workflow_steps.sql` (Migration métier)
3. `0002_rls_hardening_canonical.sql` (HARDENING RLS OBLIGATOIRE)

La migration 0002 impose `app_require_user_id()` et `app_require_tenant_id()` pour garantir un comportement fail-closed par défaut.

## 🧱 FICHIERS CLÉS
- `server/services/requestDbContext.ts` : scope transaction + injection SET LOCAL sécurisé
- `server/middleware/rlsMiddleware.ts` : enforce SET LOCAL par requête
- `server/_core/context.ts` : propage user_id + tenant_id de manière sécurisée
- `server/scripts/migrate.ts` : exécute les migrations dans l'ordre strict
- `server/scripts/verify-rls-hardening.ts` : vérification post-migration
- `server/tests/rls-hardening-contract.test.ts` : test anti-bypass RLS

## 🧪 VALIDATION
Le système est valide UNIQUEMENT si :
- ✔ 100% RLS strict
- ✔ 0 bypass possible
- ✔ 0 dépendance legacy
- ✔ 1 seul chemin canonical tenant resolution
- ✔ tests isolation passés
