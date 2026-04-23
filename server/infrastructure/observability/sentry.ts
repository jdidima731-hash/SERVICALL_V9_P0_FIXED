/**
 * SENTRY OBSERVABILITY — V8
 * ✅ FIX P1-B — Intégration réelle conditionnelle
 * Activé si SENTRY_DSN est défini, no-op gracieux sinon.
 */

import { logger } from "../logger";

let sentryInitialized = false;
let SentryNode: typeof import("@sentry/node") | null = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) {
    logger.info("[Sentry] SENTRY_DSN non défini — observabilité désactivée");
    return;
  }

  try {
    SentryNode = await import("@sentry/node");
    SentryNode.init({
      dsn,
      environment: process.env["NODE_ENV"] ?? "production",
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (process.env["NODE_ENV"] === "development") return null;
        return event;
      },
    });
    sentryInitialized = true;
    logger.info("[Sentry] Initialisé avec succès", {
      dsn: dsn.slice(0, 20) + "...",
      env: process.env["NODE_ENV"],
    });
  } catch (err: unknown) {
    logger.warn("[Sentry] Initialisation échouée — @sentry/node non installé?", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!sentryInitialized || !SentryNode) {
    logger.error("[Error]", {
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });
    return;
  }
  SentryNode.withScope((scope: any) => {
    if (context) scope.setExtras(context);
    SentryNode!.captureException(error);
  });
}

export function sentryContextMiddleware(
  req: any,
  _res: any,
  next: () => void
): void {
  if (sentryInitialized && SentryNode) {
    SentryNode.addBreadcrumb({
      category: "http",
      message: `${req.method} ${req.path}`,
      level: "info",
    });
  }
  next();
}

// Sync no-op version pour les imports synchrones existants
export function initSentrySync(): void {
  initSentry().catch((err) =>
    logger.warn("[Sentry] initSentrySync failed", { err })
  );
}
