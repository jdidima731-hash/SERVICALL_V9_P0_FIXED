# SERVICALL V8 — Guide de Déploiement Production

## Prérequis

- Node.js 20+ avec pnpm
- PostgreSQL 14+
- Redis 7+

## Installation rapide

```bash
# 1. Cloner et installer les dépendances
pnpm install

# 2. Configurer l'environnement
cp .env.example .env
# Éditez .env avec vos valeurs de production

# 3. Créer la base de données PostgreSQL
sudo -u postgres psql -c "CREATE USER servicall WITH PASSWORD 'votre_mot_de_passe';"
sudo -u postgres psql -c "CREATE DATABASE servicall_db OWNER servicall;"

# 4. Exécuter les migrations (automatique au démarrage)
pnpm run db:migrate

# 5. Builder l'application
pnpm run build

# 6. Démarrer
./start.sh
# ou
node dist/index.js
```

## Corrections appliquées (V8 → V8-PROD-READY)

| Problème | Correction |
|----------|-----------|
| `rawBody` middleware consommait le stream avant tRPC | Filtrage des routes webhook uniquement |
| CSRF `getSessionIdentifier` manquant (csrf-csrf v4) | Ajout de la configuration requise |
| `authenticateRequest` retournait `null` sans tenant | Retour `tenantId=0` pour la page select-tenant |
| `tenant.create` utilisait `adminProcedure` (requiert tenant) | Changé en `protectedProcedure` |
| `createUser` retourne un tableau, `user.id` était `undefined` | Extraction de `createdUsers[0]` |
| Colonne `tokens_valid_after` manquante dans `users` | Migration ajoutée |
| Pas de création automatique de tenant à l'inscription | Tenant créé automatiquement lors du register |
| Migrations déjà appliquées causaient une erreur au démarrage | Gestion des erreurs non-critiques dans `dbInitializationService` |

## Comptes de test

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin2@servicall.test | Admin@123456 | Admin |
| marie@servicall.test | Marie@123456 | Admin |

## Architecture

```
servicall_project/
├── server/          # Backend Node.js + tRPC + Express
├── client/          # Frontend React + Vite + TailwindCSS
├── drizzle/         # Schéma DB + migrations SQL
├── dist/            # Build de production
│   ├── index.js     # Serveur compilé
│   └── public/      # Frontend compilé
├── .env             # Configuration (NE PAS committer)
├── .env.example     # Template de configuration
└── start.sh         # Script de démarrage
```

## Healthcheck

```bash
curl http://localhost:5000/healthz
# {"status":"ok","timestamp":"..."}
```
