# SERVICALL V8 — Guide de Déploiement Production

## Statut du Build

| Composant | Statut |
|-----------|--------|
| Frontend (Vite + React) | ✅ Build OK |
| Backend (Node.js + Express) | ✅ Build OK |
| PostgreSQL | ✅ 93 tables migrées |
| Redis | ✅ Connecté et opérationnel |
| Workers BullMQ | ✅ Initialisés |
| Stockage | ✅ Configuré |

## Corrections apportées

| Fichier | Correction |
|---------|-----------|
| `client/src/contexts/ThemeContext.tsx` | **Créé** — Contexte de thème manquant |
| `client/src/lib/utils.ts` | **Créé** — Réexport depuis shared/lib |
| `client/src/lib/trpc.ts` | **Créé** — Réexport depuis shared/lib |
| `client/src/lib/callStore.ts` | **Créé** — Réexport depuis shared/lib |
| `client/src/lib/icons.ts` | **Créé** — Réexport depuis shared/lib |
| `client/src/hooks/` | **Créé** — Copie depuis shared/hooks |
| `client/src/components/ui/` | **Complété** — 55 composants UI copiés depuis shared/ui |
| `client/src/shared/ui/error-state.tsx` | **Corrigé** — Ajout export default ErrorBoundary + LoadingFallback |
| `client/src/shared/lib/i18n.ts` | **Corrigé** — Chemins locales `../locales` → `../../locales` |
| `client/src/_core/hooks/useAuth.ts` | **Créé** — Copie depuis entities/user/model |
| `server/middleware/rateLimit.ts` | **Corrigé** — Store Redis lazy (fix démarrage production) |
| `server/workflow-engine/actions/messaging/SendWhatsAppAction.ts` | **Corrigé** — Chemin twilioService |
| `server/workflow-engine/actions/messaging/SendSMSAction.ts` | **Corrigé** — Chemin twilioService |
| `server/workflow-engine/actions/telephony/InitiateCallAction.ts` | **Corrigé** — Chemin twilioService |
| `drizzle/migrations/0001_add_workflow_steps.sql` | **Créé** — Table workflow_steps manquante |

## Prérequis

- Node.js 22+
- pnpm 9+
- PostgreSQL 14+
- Redis 7+

## Installation rapide

```bash
# 1. Copier et configurer les variables d'environnement
cp .env.production.example .env
nano .env  # Remplir toutes les valeurs

# 2. Installer les dépendances et configurer la DB
bash install-production.sh

# 3. Démarrer le serveur
bash start-production.sh
```

## Installation manuelle

### PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER servicall WITH PASSWORD 'VOTRE_MOT_DE_PASSE';"
sudo -u postgres psql -c "CREATE DATABASE servicall_db OWNER servicall;"
```

### Redis

```bash
sudo apt-get install -y redis-server
sudo service redis-server start
redis-cli ping  # Doit retourner PONG
```

### Dépendances Node.js

```bash
pnpm install --frozen-lockfile
```

### Migrations de base de données

```bash
# Option 1 — Script de migration Drizzle
pnpm run db:migrate

# Option 2 — Push direct (recommandé pour la première installation)
npx drizzle-kit push --config=drizzle.config.ts
```

### Build (si nécessaire)

```bash
# Build frontend
NODE_OPTIONS='--max-old-space-size=4096' pnpm run build:client

# Build backend
pnpm run build:server

# Ou les deux en même temps
pnpm run build
```

### Démarrage du serveur

```bash
NODE_ENV=production node dist/index.js
```

## Variables d'environnement obligatoires

Voir `.env.production.example` pour la liste complète.

Les variables de sécurité suivantes sont **obligatoires** et doivent faire **minimum 32 caractères** :

- `SESSION_SECRET`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `TENANT_JWT_SECRET`
- `CSRF_SECRET`
- `ENCRYPTION_KEY` (exactement 32 caractères)
- `ENCRYPTION_SALT`
- `MASTER_KEY`

## Architecture

```
SERVICALL V8
├── dist/
│   ├── index.js          # Serveur Node.js compilé (production)
│   └── public/           # Frontend React compilé (production)
├── server/               # Code source backend
├── client/               # Code source frontend
├── drizzle/              # Schémas et migrations PostgreSQL
├── shared/               # Code partagé frontend/backend
└── uploads/              # Stockage local des fichiers
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Vérification de santé |
| `POST /api/trpc/*` | API tRPC |
| `GET /` | Application frontend |
| `WS /ws` | WebSocket temps réel |

## Tables de base de données (93 tables)

Le schéma complet inclut les modules suivants :
- Authentification et gestion des utilisateurs
- CRM (contacts, prospects, leads, deals)
- Téléphonie (appels, enregistrements, campagnes)
- Recrutement (offres, candidats, entretiens)
- Facturation (factures, clients)
- IA et automatisation (workflows, blueprints, agents)
- Conformité RGPD et audit
- Multi-tenant (business entities, tenants)
