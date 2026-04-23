
/**
 * OPENTELEMETRY TRACING
 * ✅ PHASE 5 — Tâche 13 : Tracing distribué avec OpenTelemetry
 *
 * Trace les appels :
 *   - HTTP (Express)
 *   - Redis (ioredis)
 *   - OpenAI
 *   - Twilio
 *
 * NOTE : Ce fichier doit être importé EN PREMIER dans le point d'entrée
 * de l'application (avant tout autre import) pour que l'instrumentation
 * auto fonctionne correctement.
 */
import { logger } from "../logger";
// ✅ FIX TS2307: Import statique du type Span depuis @opentelemetry/api (maintenant installé)
import type { Span } from "@opentelemetry/api";

// Vérification de la disponibilité du SDK OpenTelemetry
let otelAvailable = false;

try {
  // Import dynamique pour éviter les erreurs si le package n'est pas installé
  const sdkNodeModule = await import("@opentelemetry/sdk-node").catch(() => null);
  const autoInstrModule = await import("@opentelemetry/auto-instrumentations-node").catch(() => null);
  const otlpExporterModule = await import("@opentelemetry/exporter-trace-otlp-http").catch(() => null);
  const resourcesModule = await import("@opentelemetry/resources").catch(() => null);
  const semConvModule = await import("@opentelemetry/semantic-conventions").catch(() => null);

  const NodeSDK = sdkNodeModule?.NodeSDK ?? null;
  const getNodeAutoInstrumentations = autoInstrModule?.getNodeAutoInstrumentations ?? null;
  const OTLPTraceExporter = otlpExporterModule?.OTLPTraceExporter ?? null;
  
  const resourceFromAttributes = (resourcesModule as typeof import('@opentelemetry/resources'))?.resourceFromAttributes ?? null;
  const SEMRESATTRS_SERVICE_NAME = (semConvModule as typeof import('@opentelemetry/semantic-conventions'))?.SEMRESATTRS_SERVICE_NAME ?? "service.name";
  const SEMRESATTRS_SERVICE_VERSION = (semConvModule as typeof import('@opentelemetry/semantic-conventions'))?.SEMRESATTRS_SERVICE_VERSION ?? "service.version";

  if (NodeSDK && getNodeAutoInstrumentations && resourceFromAttributes) {
    otelAvailable = true;

    const exporterUrl =
      process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] || "http://localhost:4318/v1/traces";

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: "servicall-saas",
        [SEMRESATTRS_SERVICE_VERSION]: process.env["npm_package_version"] || "2.0.0",
        environment: process.env["NODE_ENV"] ?? "development",
      }),
      traceExporter: OTLPTraceExporter
        ? new OTLPTraceExporter({ url: exporterUrl })
        : undefined,
      instrumentations: [
        getNodeAutoInstrumentations({
          // HTTP : trace toutes les requêtes entrantes et sortantes
          "@opentelemetry/instrumentation-http": { enabled: true },
          // Express : trace les routes et middlewares
          "@opentelemetry/instrumentation-express": { enabled: true },
          // Redis / ioredis : trace les commandes Redis
          "@opentelemetry/instrumentation-ioredis": { enabled: true },
          // Désactiver les instrumentations non nécessaires
          "@opentelemetry/instrumentation-fs": { enabled: false },
          "@opentelemetry/instrumentation-dns": { enabled: false },
        }),
      ],
    });

    sdk.start();

    // Arrêt propre à la fermeture de l'application
    process.on("SIGTERM", () => {
      
      sdk.shutdown().catch((err: any) => logger.error("[OTel] Shutdown error", err));
    });

    logger.info("[OTel] OpenTelemetry tracing initialized", {
      exporterUrl,
      service: "servicall-saas",
    });
  }
} catch (_err) {
  // OpenTelemetry non disponible, on continue sans tracing
}

if (!otelAvailable) {
  logger.warn(
    "[OTel] OpenTelemetry packages not installed. " +
      "Install with: pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node"
  );
}

/**
 * Crée un span manuel pour tracer une opération spécifique.
 * Utilisé pour tracer les appels OpenAI et Twilio qui ne sont pas
 * instrumentés automatiquement.
 */
export async function withSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const otelApi = await import("@opentelemetry/api").catch(() => null);

    if (!otelApi) {
      return fn();
    }

    const { trace, context, SpanStatusCode } = otelApi;

    if (!trace || !context || !SpanStatusCode) {
      return fn();
    }

    const tracer = trace.getTracer("servicall-manual");
    // ✅ FIX TS7006: Typage explicite du span pour éviter l'erreur "implicitly has unknown type"
    return tracer.startActiveSpan(name, { attributes }, async (span: Span) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: unknown) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  } catch {
    return fn();
  }
}