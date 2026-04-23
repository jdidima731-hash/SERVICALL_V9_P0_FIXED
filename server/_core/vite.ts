/**
 * vite.ts — Serveur statique production + serveur de dev Vite
 *
 * ARCHITECTURE PRODUCTION-SAFE :
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  NODE_ENV=development  →  setupVite()   (Vite HMR)      │
 * │  NODE_ENV=production   →  serveStatic() (dist/public/)  │
 * └─────────────────────────────────────────────────────────┘
 *
 * Règle absolue : le mode est déterminé UNIQUEMENT par NODE_ENV.
 * La présence ou absence de dist/ ne modifie jamais le comportement.
 *
 * En production :
 *   - Les fichiers statiques sont servis depuis dist/public/
 *   - Le fallback SPA renvoie dist/public/index.html pour toute route non-API
 *   - Vite et vite.config ne sont jamais importés (devDependency absente en prod)
 *
 * En développement :
 *   - Vite est importé dynamiquement (lazy) pour éviter tout bundling en prod
 *   - HMR actif sur le même serveur HTTP
 */

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../infrastructure/logger";

// Résolution de __dirname compatible ESM (produit par esbuild --format=esm)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Résout le répertoire racine du projet de façon fiable quel que soit cwd().
 *
 * En production (dist/index.js) : __dirname = <root>/dist
 *   → projectRoot = <root>
 * En développement (server/_core/vite.ts) : __dirname = <root>/server/_core
 *   → projectRoot = <root>
 */
function resolveProjectRoot(): string {
  // En prod, dist/index.js est à <root>/dist/index.js
  // __dirname = <root>/dist → on remonte d'un niveau
  if (__dirname.endsWith("/dist") || __dirname.endsWith("\\dist")) {
    return path.resolve(__dirname, "..");
  }
  // En dev TypeScript, server/_core/vite.ts → remonter de 2 niveaux
  return path.resolve(__dirname, "..", "..");
}

const PROJECT_ROOT = resolveProjectRoot();

// ─── Mode développement — Vite HMR ───────────────────────────────────────────

export async function setupVite(app: Express, server: Server) {
  logger.info("[Vite] Mode développement — démarrage Vite HMR");

  // Import dynamique — Vite absent en prod, présent en dev uniquement
  const { createServer: createViteServer } = await import("vite");

  // Import dynamique de vite.config depuis la racine projet
  // Utilisé uniquement en dev — jamais bundlé par esbuild grâce à --external:vite
  const viteConfigPath = path.join(PROJECT_ROOT, "vite.config.ts");
  const { default: viteConfig } = await import(/* @vite-ignore */ viteConfigPath);

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Fallback SPA en dev : transformer index.html via Vite
  app.use("*", async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.join(PROJECT_ROOT, "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e: any) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// ─── Mode production — Fichiers statiques ────────────────────────────────────

export function serveStatic(app: Express) {
  const distPath = path.join(PROJECT_ROOT, "dist", "public");
  const indexPath = path.join(distPath, "index.html");

  logger.info(`[Static] Serving from: ${distPath}`);

  if (!fs.existsSync(distPath)) {
    logger.error(`[Static] ❌ dist/public/ introuvable`);
    logger.error(`[Static]    → Exécutez 'pnpm build' puis redémarrez le serveur`);
    logger.error(`[Static]    → PROJECT_ROOT résolu : ${PROJECT_ROOT}`);
    // On continue — le fallback SPA renverra une page d'erreur claire
  }

  // ── Assets statiques (JS/CSS/images) — cache 1 an (fichiers hashés) ─────
  app.use(
    express.static(distPath, {
      maxAge: "1y",
      etag: true,
      lastModified: true,
      extensions: ["js", "css", "html", "json"],
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
        res.setHeader("Origin-Agent-Cluster", "?0");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    })
  );

  // ── Fallback SPA — toutes routes non-API → index.html ───────────────────
  //
  // Ordre important : ce handler vient APRÈS express.static et APRÈS toutes
  // les routes /api/*. Il ne capte que les routes frontend (React Router).
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    // Laisser passer les routes API, metrics et health vers les handlers suivants
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/metrics") ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/healthz") ||
      req.path.startsWith("/voice-stream")
    ) {
      return next();
    }

    if (!fs.existsSync(indexPath)) {
      logger.error(`[Static] index.html introuvable : ${indexPath}`);
      return res.status(503).send(`
        <html><head><title>Build manquant</title></head>
        <body style="font-family:monospace;padding:50px;max-width:600px;margin:auto">
          <h1>⚠️ Application non compilée</h1>
          <p>Le build frontend est introuvable.</p>
          <pre>pnpm build\nNODE_ENV=production node dist/index.js</pre>
          <p style="color:#888;font-size:12px">dist/public/index.html attendu dans : ${distPath}</p>
        </body></html>
      `);
    }

    // index.html — jamais en cache (les assets hashés le sont, pas lui)
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Origin-Agent-Cluster", "?0");

    // Injection du nonce CSP si présent (middleware Helmet avec nonce)
    const nonce = (res.locals as Record<string, unknown>)["cspNonce"] as string | undefined;
    if (nonce) {
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        html = html.replace(/<script/g, `<script nonce="${nonce}"`);
        html = html.replace(/<link rel="modulepreload"/g, `<link rel="modulepreload" nonce="${nonce}"`);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      } catch (err: any) {
        logger.error("[Static] Erreur injection nonce", err);
      }
    }

    res.sendFile(indexPath);
  });
}
