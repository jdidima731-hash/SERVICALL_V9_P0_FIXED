# ============================================================
# SERVICALL V8 — Dockerfile Production (Corrigé P0)
# Multi-stage build : builder → runner
# ============================================================

# ── Stage 1 : Builder ────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Installer pnpm
RUN npm install -g pnpm

# Copier les manifestes de dépendances
COPY package.json pnpm-lock.yaml* ./

# Installer toutes les dépendances
RUN pnpm install --frozen-lockfile || pnpm install

# Copier le reste du code
COPY . .

# Build frontend (Vite) + backend (tsc)
RUN NODE_OPTIONS='--max-old-space-size=4096' pnpm run build

# ── Stage 2 : Runner ─────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Installer outils système minimaux
RUN apk add --no-cache tini wget

# Installer pnpm
RUN npm install -g pnpm

# Copier uniquement ce qui est nécessaire en runtime
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copier le build et les assets depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server/scripts ./server/scripts
# ✅ FIX P0: Correction du nom du fichier ecosystem
COPY --from=builder /app/ecosystem.config.cjs ./ecosystem.config.cjs

# Utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S servicall && \
    adduser -S servicall -u 1001 -G servicall && \
    chown -R servicall:servicall /app

USER servicall

# Port exposé
EXPOSE 5000

# Variables d'environnement par défaut
ENV NODE_ENV=production \
    PORT=5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/healthz || exit 1

# Démarrage avec tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
