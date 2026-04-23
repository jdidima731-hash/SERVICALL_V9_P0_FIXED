# Servicall V8 - Checklist de Sécurité (Production Ready)

Cette checklist récapitule les mesures de sécurité implémentées et les points de vérification essentiels avant et après le déploiement en production de Servicall V8.

## 1. Configuration des Variables d'Environnement

*   **Tous les secrets critiques sont définis :** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TENANT_JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_SALT`, `MASTER_KEY`, `COOKIE_SECRET`.
    *   **Vérification :** L'application doit crasher au démarrage si l'un de ces secrets est manquant ou trop court (moins de 32 caractères).
*   **`ADMIN_EMAIL` et `ADMIN_PASSWORD` sont définis :** Pour la création du compte administrateur initial.
    *   **Vérification :** Le compte administrateur par défaut (`admin@servicall.com` / `Admin@2026!`) n'est plus utilisé.
*   **`DATABASE_URL` et `REDIS_URL` sont valides :** Pointent vers des instances sécurisées et dédiées.
    *   **Vérification :** L'application doit crasher au démarrage si la base de données est inaccessible en production.
*   **`ALLOWED_ORIGINS` est configuré :** Liste les domaines autorisés pour le frontend.
    *   **Vérification :** Seules les origines explicitement listées peuvent accéder à l'API.

## 2. Sécurité de la Base de Données (PostgreSQL)

*   **`BYPASSRLS` est supprimé :** L'utilisateur applicatif n'a plus la permission de contourner le Row Level Security.
    *   **Vérification :** Aucune occurrence de `BYPASSRLS` ne doit exister dans les scripts SQL ou les migrations.
*   **RLS est activé et forcé sur toutes les tables sensibles :** Chaque table métier (`prospects`, `calls`, `messages`, etc.) est protégée par RLS.
    *   **Vérification :** Exécutez le script de migration `scripts/auto-migrate-rls.ts` et vérifiez son rapport final. Toutes les tables sensibles doivent avoir une politique `tenant_isolation`.
*   **`tenant_id` est unifié :** Seule la variable `app.tenant_id` est utilisée pour le contexte RLS.
    *   **Vérification :** Aucune occurrence de `app.current_tenant_id` ne doit exister dans le code.
*   **Fonction `public.secure_get_user` :** Utilisée pour l'authentification afin de récupérer les informations utilisateur de manière sécurisée, sans contourner RLS.
    *   **Vérification :** La fonction doit exister dans la base de données après la migration.

## 3. Sécurité de l'Application (Node.js/Express)

*   **Content Security Policy (CSP) durcie :** Suppression de `unsafe-inline` et `unsafe-eval` pour les scripts.
    *   **Vérification :** Les directives `scriptSrc` et `objectSrc` dans `server/index.ts` doivent être restrictives.
*   **Authentification WebSocket sécurisée :** Les connexions WebSocket exigent un token JWT valide.
    *   **Vérification :** Toute tentative de connexion WebSocket sans token ou avec un token invalide doit être rejetée.
*   **Middleware API Key sécurisé :** Le middleware `apiKeyMiddleware.ts` est `fail-closed`.
    *   **Vérification :** En cas d'erreur de validation de clé API ou d'indisponibilité de la DB, l'accès est refusé (HTTP 401/403/500).
*   **BYOK (Bring Your Own Key) :** Les clés API sensibles sont chiffrées en AES-256-GCM dans la base de données.
    *   **Vérification :** `server/services/byokService.ts` doit utiliser `crypto.createCipheriv` avec AES-256-GCM.

## 4. Sécurité Docker

*   **Ports restreints :** Les services `db` et `redis` ne sont pas exposés publiquement. Le service `app` est exposé uniquement sur `127.0.0.1:5000`.
    *   **Vérification :** Le `docker-compose.yml` doit refléter ces restrictions.
*   **Réseaux internes :** Les services communiquent via un réseau Docker interne.
    *   **Vérification :** Le `docker-compose.yml` doit définir un réseau `internal` et l'assigner aux services.
*   **Restrictions de capacités (cap_drop) :** Le conteneur `app` a ses capacités Linux réduites au minimum.
    *   **Vérification :** `cap_drop: - ALL` est présent dans la configuration du service `app`.
*   **`no-new-privileges` :** Empêche le conteneur d'acquérir de nouveaux privilèges.
    *   **Vérification :** `security_opt: - no-new-privileges:true` est présent.
*   **Utilisateur non-root :** Le conteneur `app` s'exécute avec un utilisateur non-root (`servicall`).
    *   **Vérification :** Le `Dockerfile` doit inclure `USER servicall`.
*   **`.dockerignore` complet :** Exclut les fichiers sensibles et inutiles en production (`.env`, `docs`, `scripts admin`, tests, etc.).
    *   **Vérification :** Le fichier `.dockerignore` doit contenir les exclusions pertinentes.

## 5. Tests et Surveillance

*   **Tests de sécurité :** Les tests unitaires et d'intégration couvrent les aspects critiques de sécurité (isolation tenant, authentification JWT, WebSocket).
    *   **Vérification :** Exécutez `pnpm test` et assurez-vous que tous les tests de sécurité passent.
*   **Surveillance (Sentry) :** Sentry est configuré pour la remontée d'erreurs en production.
    *   **Vérification :** `SENTRY_DSN` et `SENTRY_ENVIRONMENT` sont définis dans `.env`.

---

**Manus AI**
*Version: 1.0.0 (Hardened)*
*Date: 17 Avril 2026*
