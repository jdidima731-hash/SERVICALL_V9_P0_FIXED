import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { randomBytes } from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// ✅ FIX CRITIQUE: Imports déplacés dans startServer pour éviter les side-effects Redis avant connexion
// import { appRouter } from "./routers";
// import { createContext } from "./_core/context";
import { serveStatic, setupVite } from "./_core/vite";
import { logger } from "./infrastructure/logger";
import { callbackRouter } from "./routers/callbackRouter";
import twilioRouter from "./api/twilio";
import { dbManager } from "./services/dbManager";
import { initializeDatabaseOrExit } from "./services/dbInitializationService";
import { validateEnv as validateEnvSchema } from "./config/envSchema";
import { setupGlobalErrorHandlers, expressErrorHandler, notFoundHandler } from "./middleware/errorHandler";
import { ENV } from "./_core/env";
import WebSocket from "ws";
import { jwtVerify } from "jose";
// ✅ FIX CRITIQUE: Imports déplacés dans startServer pour éviter les side-effects
// import { RealtimeVoicePipeline } from "./services/realtimeVoicePipeline";
// import { storageService } from "./services/storage";
// import { globalRateLimiter, authRateLimiter, userRateLimiter } from "./middleware/rateLimitMiddleware";
// import { auditService, AuditAction } from "./infrastructure/audit/auditService";
// import { registerCRMClient } from "./infrastructure/websocketBroadcast";
// import { startCallbackWorker } from "./workers/callbackWorker";
// import { initSentry, sentryContextMiddleware } from "./infrastructure/observability/sentry";
// import { handleUnifiedStripeWebhook } from "./webhooks/unifiedStripeWebhook";
// import { apiLimiter } from "./middleware/rateLimit";
// import { AuthService } from "./services/authService";
// import { setupMetricsEndpoint } from "./services/metricsService";
import { getRedisClient } from "./infrastructure/redis/redis.client";

// ✅ FIX CRITIQUE — Token store pour le câblage WebSocket IA ←→ Twilio
export interface VoiceStreamToken {
  tenantId: number;
  callSid: string;
  callId: number;
  expiresAt: number; // ms timestamp
  agentId?: number;
  agentMode?: "AI" | "HUMAN" | "BOTH";
  prospectPhone?: string;
  prospectName?: string;
  prospectId?: number;
}

/**
 * ✅ FIX P0: voiceStreamTokens migré vers Redis
 * Évite la perte de tokens lors d'un redémarrage ou d'un scaling horizontal.
 */
export const voiceStreamTokens = {
  async get(token: string): Promise<VoiceStreamToken | null> {
    const redis = getRedisClient();
    const data = await redis.get(`voice_token:${token}`);
    return data ? JSON.parse(data) : null;
  },
  async set(token: string, data: VoiceStreamToken): Promise<void> {
    const redis = getRedisClient();
    const ttl = Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000));
    await redis.set(`voice_token:${token}`, JSON.stringify(data), "EX", ttl || 3600);
  },
  async delete(token: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(`voice_token:${token}`);
  }
};

async function startServer() {
  // 1. Initialisation de l'infrastructure
  const { initSentry } = await import("./infrastructure/observability/sentry");
  initSentry();
  setupGlobalErrorHandlers();
  validateEnvSchema();

  // ✅ FIX CRITIQUE : Connecter Redis AVANT tout import de service (BullMQ, Queues, etc.)
  // Certains services appellent getRedisClient() au niveau du module lors de l'import.
  logger.info("[Server] Connexion à Redis...");
  {
    const { connectRedis } = await import("./infrastructure/redis/redis.client");
    await connectRedis(); // Fail-fast en production (géré dans connectRedis)
    logger.info("[Server] ✅ Redis connecté");
  }

  const skipDb = !ENV.dbEnabled || process.env["DISABLE_DB"] === "true" || process.env["SKIP_DB_INIT"] === "true";

  logger.info("[Server] 🔄 Connexion à la base de données...");
  if (skipDb) {
    logger.warn("[Server] ⚠️ Base de données désactivée — démarrage en mode dégradé contrôlé");
  } else {
    await dbManager.initialize();
    await initializeDatabaseOrExit();
    logger.info("[Server] ✅ Base de données prête");
  }
    
    const { start: startCache } = await import("./services/cacheService.enhanced");
    await startCache();
    logger.info("[Server] ✅ Cache amélioré initialisé");

    // ✅ Initialisation manuelle des queues de recrutement après Redis
    const { initializeRecruitmentQueues, initializeRecruitmentWorkers } = await import("./services/recruitmentQueueService");
    initializeRecruitmentQueues();
    initializeRecruitmentWorkers();
    logger.info("[Server] ✅ Queues de recrutement initialisées");

  logger.info("[Server] Initialisation du stockage...");
  try {
    const { storageService } = await import("./services/storage");
    await storageService.init();
    logger.info("[Server] ✅ Stockage initialisé");
  } catch (e: any) {
    logger.warn("[Server] ⚠️ Stockage non initialisé", { error: e });
  }

  {
    const { startAllWorkers } = await import("./workers");
    await Promise.resolve(startAllWorkers());
    logger.info("[Server] ✅ Workers BullMQ démarrés");
  }

  // 2. Configuration Express
  const app = express();
  const httpServer = createServer(app);
  app.set("trust proxy", 1); // ✅ FIX: requis pour cookies secure derrière proxy

  // Middleware Sentry
  const { sentryContextMiddleware } = await import("./infrastructure/observability/sentry");
  app.use(sentryContextMiddleware);

  // ✅ FIX CSP: Middleware nonce — génère un nonce par requête pour les scripts inline
  // Permet de supprimer 'unsafe-inline' tout en autorisant les scripts légitimes
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const nonce = randomBytes(16).toString('base64');
    (res.locals as Record<string, unknown>)['cspNonce'] = nonce;
    next();
  });

  // Sécurité de base
  app.use((req: Request, res: Response, next: NextFunction) => {
    const nonce = (res.locals as Record<string, unknown>)['cspNonce'] as string;
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // ✅ FIX CSP: nonce dynamique — plus de 'unsafe-inline'
          scriptSrc: ["'self'", `'nonce-${nonce}'`, "https://cdn.jsdelivr.net", "https://browser.sentry-cdn.com"],
          styleSrc: ["'self'", `'nonce-${nonce}'`, "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://*.stripe.com", "https://*.googleusercontent.com"],
          connectSrc: ["'self'", "wss:", "https://*.sentry.io", "https://*.stripe.com"],
          frameSrc: ["'self'", "https://*.stripe.com"],
          upgradeInsecureRequests: [],
        },
      },
    })(req, res, next);
  });

  // CORS : appliqué UNIQUEMENT aux routes /api et /voice-stream.
  // Les assets statiques (JS/CSS) sont servis par express.static() APRÈS ce bloc,
  // avec leur propre Access-Control-Allow-Origin: * (voir _core/vite.ts setHeaders).
  // Un cors() global bloque les assets en prod car il s'applique avant serveStatic.
  const allowedOrigins = process.env["ALLOWED_ORIGINS"]
    ? process.env["ALLOWED_ORIGINS"].split(",").map(o => o.trim())
    : [];

  const corsMiddleware = cors({
    origin: (origin, callback) => {
      // Requêtes sans origin (server-to-server, curl, Postman)
      if (!origin) return callback(null, true);

      if (process.env["NODE_ENV"] !== "production") {
        return callback(null, true); // dev: tout autoriser
      }

      // Wildcard explicite : ALLOWED_ORIGINS=* autorise tout (pratique pour sandbox/staging)
      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      // Production fail-closed : ALLOWED_ORIGINS obligatoire
      if (allowedOrigins.length === 0) {
        logger.error("[CORS] ALLOWED_ORIGINS non configuré — origines API bloquées");
        return callback(new Error("CORS: ALLOWED_ORIGINS manquant en production"));
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn("[CORS] Blocked origin", { origin });
      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
  });

  // Appliquer CORS sur les routes API et WebSocket uniquement (PAS les assets statiques)
  app.use("/api", corsMiddleware);
  app.use("/voice-stream", corsMiddleware);

  // ✅ FIX P0: Le raw body global est supprimé pour éviter la double consommation HTTP.
  // La route Stripe est montée ici, AVANT tout parser JSON concurrent.
  // Elle utilise express.raw() pour garantir un Buffer brut, exigé par la vérification de signature.
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res, next) => {
    const { handleUnifiedStripeWebhook } = await import("./webhooks/unifiedStripeWebhook");
    handleUnifiedStripeWebhook(req, res).catch(next);
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser(ENV.cookieSecret));

  // CSRF Protection (csrf-csrf v4 compatible)
  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => ENV.csrfSecret,
    // Identifiant stable derrière proxy — req.ip change avec X-Forwarded-For
    getSessionIdentifier: (req: Request) => {
      // Ordre de priorité : cookie de session > IP réelle (via trust proxy 1) > user-agent > fallback
      return req.cookies?.['servicall_session']
        || req.ip
        || req.headers['user-agent']
        || 'anonymous';
    },
    cookieName: "x-csrf-token",
    cookieOptions: {
      httpOnly: false, // Le client JS doit pouvoir lire le token (double-submit pattern)
      sameSite: ENV.nodeEnv === "production" ? ("none" as const) : ("lax" as const),
      secure: ENV.nodeEnv === "production",
    },
    // Le token est envoyé par le client dans le header x-csrf-token (défaut csrf-csrf v4)
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  });

  // Rate Limiting
  const { globalRateLimiter, authRateLimiter } = await import("./middleware/rateLimitMiddleware");
  app.use("/api", globalRateLimiter);
  app.use("/api/auth", authRateLimiter);

  // Webhooks Stripe déplacés plus haut avant express.json

  // ✅ FIX: Montage du callbackRouter (Express)
  app.use("/api/callbacks", callbackRouter);

  // ✅ FIX CRITIQUE: Branchement du router Twilio pour les webhooks
  app.use("/api/twilio", twilioRouter);

  // CSRF token endpoint — must be BEFORE doubleCsrfProtection middleware
  // IMPORTANT: errors here are fatal — do NOT silently return csrfEnabled: false.
  // A degraded CSRF response means all subsequent mutating requests are unprotected.
  app.get('/api/csrf-token', (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = generateCsrfToken(req, res, { overwrite: true });
      res.json({ csrfEnabled: true, csrfToken: token });
    } catch (err: any) {
      logger.error("[CSRF] Failed to generate CSRF token — this is a hard error", { error: err.message });
      res.status(500).json({ error: "CSRF token generation failed. Please retry." });
    }
  });

  // Activation effective de la protection CSRF pour les routes API navigateur
  app.use("/api", doubleCsrfProtection);

  // ✅ FIX P2.5: Endpoint Prometheus /metrics
  const { setupMetricsEndpoint } = await import("./services/metricsService");
  setupMetricsEndpoint(app);

  // tRPC Adapter
  const { appRouter } = await import("./routers");
  const { createContext } = await import("./_core/context");
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Healthcheck
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Frontend Static Files
  if (ENV.nodeEnv === "production") {
    await serveStatic(app);
  } else {
    await setupVite(app, httpServer);
  }

  // Error Handlers
  app.use(notFoundHandler);
  app.use(expressErrorHandler);

  // 3. WebSocket Server
  const { WebSocketServer } = await import("ws");
  // ✅ FIX P0-A : endpoint unifié sur /voice-stream (aligné avec twilioService.ts)
  const wss = new WebSocketServer({ server: httpServer, path: "/voice-stream" });

  wss.on("connection", async (ws: WebSocket, req: Request) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "Token missing");
      return;
    }

    try {
      // Vérification du token (JWT ou Voice Token)
      // ✅ FIX P0-A : préfixe unifié sur vst_ (aligné avec twilioService.ts createStreamToken)
      if (token.startsWith("vst_")) {
        const voiceToken = await voiceStreamTokens.get(token);
        if (!voiceToken || voiceToken.expiresAt < Date.now()) {
          ws.close(1008, "Invalid or expired voice token");
          return;
        }
        
        // Initialisation du pipeline voix temps réel
        const { RealtimeVoicePipelineCompat } = await import("./services/realtimeVoicePipelineCompat");
        const pipeline = new RealtimeVoicePipelineCompat(ws, voiceToken);
        await pipeline.start();
      } else {
        // WebSocket standard (CRM/Dashboard)
        const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.jwtSecret));
        const userId = Number(payload.sub);
        const tenantId = Number(payload.tenantId);

        if (isNaN(userId) || isNaN(tenantId)) {
          ws.close(1008, "Invalid token payload");
          return;
        }

        const { registerCRMClient } = await import("./infrastructure/websocketBroadcast");
        registerCRMClient(tenantId, userId, ws);
      }
    } catch (error) {
      logger.error("[WS] Connection error", { error });
      ws.close(1011, "Internal server error");
    }
  });

  // 4. Start Listening
  const port = ENV.port;
  logger.info(`[Server] Tentative d'écoute sur le port ${port}...`);
  httpServer.listen(port, "0.0.0.0", () => {
    logger.info(`[Server] 🚀 Servicall V8 démarré sur le port ${port} (${ENV.nodeEnv})`);
  });
}

logger.info("[Server] Appel de startServer()...");
startServer().catch((err) => {
  logger.error("Fatal server error:", err);
  process.exit(1);
});
