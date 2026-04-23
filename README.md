# SERVICALL V8 — Enterprise Ready (Hardened & Verified)

Ce dépôt contient la version **V8** durcie et industrialisée de Servicall. Tous les composants critiques ont été audités et corrigés pour un déploiement en production réelle.

## ✅ État de l'Audit V8 (Avril 2026)

- **Type Safety** : Réduction massive de la dette technique. Suppression des `@ts-nocheck` sur les services critiques (`Twilio`, `Auth`, `Security`, `AI`).
- **Dialer & Téléphonie** : Service Twilio raccordé aux flux réels avec gestion robuste des erreurs et des transferts.
- **Workflow Engine** : Moteur backend stabilisé et Frontend `WorkflowBuilder` typé avec tRPC.
- **Conformité RGPD** : Suppression des appels tiers non consentis (ipapi.co) et gestion dynamique des consentements par tenant.
- **Sécurité SaaS** : Isolation stricte des tenants (RLS) et middlewares de sécurité durcis.

## 🚀 Installation & Déploiement

### Pré-requis
*   Docker et Docker Compose (version 3.9 ou supérieure)
*   Node.js (version 20.x LTS)
*   pnpm (version 8.x ou supérieure)

### Démarrage Rapide
```bash
# Installation des dépendances
pnpm install

# Validation du typage et build
pnpm test:typecheck
pnpm build

# Lancement via Docker
docker-compose up -d
```

## ⚙️ Configuration des Variables d'Environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```dotenv
# --- Base de Données PostgreSQL ---
DATABASE_URL="postgresql://servicall:VOTRE_MDP_POSTGRES@db:5432/servicall"
POSTGRES_PASSWORD="VOTRE_MDP_POSTGRES"

# --- Secrets d'Application (32+ caractères) ---
JWT_SECRET="VOTRE_SECRET_JWT"
ENCRYPTION_KEY="VOTRE_CLE_CHIFFREMENT"
CSRF_SECRET="VOTRE_SECRET_CSRF"

# --- Redis (Obligatoire) ---
REDIS_URL="redis://redis:6379"

# --- Services Externes ---
OPENAI_API_KEY="sk-..."
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1234567890"
```

## 🛠 Architecture

- **Frontend** : React, TypeScript, TailwindCSS, tRPC Client.
- **Backend** : Node.js, Express, tRPC Server, Drizzle ORM.
- **Infrastructure** : PostgreSQL, Redis, BullMQ.
- **IA** : OpenAI GPT-4o, Moteur de dialogue propriétaire, Scoring de leads IA.

---
**Version: 8.0.0 (Verified Enterprise Production)**
**Audit & Refactoring par Manus AI**
**Date: 22 Avril 2026**
