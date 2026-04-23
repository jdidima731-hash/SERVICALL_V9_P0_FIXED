import { ENV } from "./env";
import { recordOpenAIUsage } from "../services/openaiUsageMonitor";
import { logger } from "../infrastructure/logger";
import { ResilienceService } from "../services/resilienceService";
import { AI_MODEL } from "./aiModels";
import * as fs from "fs";
import * as path from "path";

// ─── BYOK Key Resolver ────────────────────────────────────────────────────────
// Résout la clé OpenAI à utiliser pour un tenant donné.
// Priorité : clé BYOK tenant (interface) > clé ENV globale (fallback demo/dev)
export async function resolveOpenAIKey(tenantId: number): Promise<string> {
  try {
    const { getAPIKey } = await import("../services/byokService");
    const byokKey = await getAPIKey(tenantId, "openai");
    if (byokKey && byokKey.startsWith("sk-")) {
      logger.debug("[LLM] Using BYOK OpenAI key for tenant", { tenantId });
      return byokKey;
    }
  } catch (err: any) {
    logger.warn("[LLM] BYOK key lookup failed, falling back to ENV key", { tenantId, err });
  }
  // Fallback : clé globale ENV (page démo, ou tenant sans BYOK configuré)
  return ENV.openaiApiKey ?? "";
}

// ============================================================
// ✅ CORRECTION CRITIQUE — Timeout Manager (Promise.race)
// Évite les blocages tRPC causés par des appels OpenAI trop longs
// ============================================================

/**
 * Wraps a promise with a hard timeout using Promise.race.
 * Throws an Error("LLM timeout") if the promise exceeds the given ms.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("LLM timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

/** Fallback message returned when the LLM times out */
export const LLM_TIMEOUT_FALLBACK =
  "Je rencontre un petit délai, laissez-moi vérifier cela...";

/** Log AI timeout errors to logs/ai-errors.log */
function logAITimeout(service: string, context?: Record<string, unknown>): void {
  const entry = {
    level: "AI_TIMEOUT",
    service,
    timestamp: Date.now(),
    ...context,
  };
  logger.error("AI_TIMEOUT", entry);
  try {
    const logsDir = path.resolve(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "ai-errors.log"),
      JSON.stringify(entry) + "\n",
      "utf8"
    );
  } catch (_) {
    // Logging must never crash the application
  }
}

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  model?: string;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  /** Sampling temperature (0.0–2.0). Passed through to the LLM provider when supported. */
  temperature?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0]?.type === "text") {
    const textPart = contentParts[0]! as TextContent;
    return {
      role,
      name,
      content: textPart.text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0]!.function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

// ✅ CORRIGÉ: Utilisation de l'API officielle OpenAI. FORGE_API_URL doit être https://api.openai.com/v1
const resolveApiUrl = () => {
  const base = (ENV.openaiApiUrl && ENV.openaiApiUrl.trim().length > 0)
    ? ENV.openaiApiUrl.replace(/\/+$/, "")
    : "https://api.openai.com/v1";
  // Si la base se termine déjà par /v1, ne pas rajouter /v1
  if (base.endsWith("/v1")) {
    return `${base}/chat/completions`;
  }
  return `${base}/v1/chat/completions`;
};

// assertApiKey est maintenant inline dans invokeLLM pour une meilleure gestion d'erreur
// const assertApiKey = () => {
//   if (!ENV.openaiApiKey) {
//     throw new Error("OPENAI_API_KEY is not configured");
//   }
// };

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

/**
 * Validates the LLM response structure
 */
function validateLLMResponse(data: any): boolean {
  return (
    data &&
    Array.isArray(data.choices) &&
    data.choices.length > 0 &&
    data.choices[0].message
  );
}

export async function invokeLLM(tenantId: number, params: InvokeParams): Promise<InvokeResult> {
  // ✅ FIX CRITIQUE — Résolution de la clé OpenAI : BYOK tenant > ENV global
  // Si le tenant a configuré sa propre clé via l'interface BYOK, elle est utilisée
  // en priorité. Sinon, fallback sur la clé ENV (démo/dev ou clé commune).
  const resolvedApiKey = await resolveOpenAIKey(tenantId);

  if (!resolvedApiKey || !resolvedApiKey.startsWith("sk-")) {
    logger.warn("[LLM] Aucune clé OpenAI valide disponible (BYOK ni ENV).", { tenantId });
    return {
      id: "fallback-invalid-key",
      created: Math.floor(Date.now() / 1000),
      model: AI_MODEL.DEFAULT,
      choices: [
        {
          message: {
            role: "assistant",
            content: "Service IA temporairement indisponible",
          },
          finish_reason: "invalid_api_key",
          index: 0,
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    } ;
  }

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: AI_MODEL.DEFAULT, // ✅ PHASE 1 — Tâche 1 : Modèle standardisé via AI_MODEL
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload['tools'] = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload['tool_choice'] = normalizedToolChoice;
  }

  payload["max_tokens"] = 32768;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload['response_format'] = normalizedResponseFormat;
  }

  // ✅ CORRECTION CRITIQUE — Timeout réduit à 5 000 ms via withTimeout + Promise.race
  // Évite les blocages tRPC de 30 s signalés dans les logs
  let result: InvokeResult;
  try {
    result = await withTimeout(
      ResilienceService.execute(
        async () => {
          const response = await fetch(resolveApiUrl(), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              // ✅ Clé résolue dynamiquement : BYOK tenant ou ENV global
              authorization: `Bearer ${resolvedApiKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(
              `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
            );
            (error as { status?: number }).status = response.status;
            throw error;
          }

          return (await response.json()) as InvokeResult;
        },
        {
          name: "LLM_INVOKE",
          module: "IA",
          timeoutMs: 5000, // ✅ Réduit de 30 000 ms à 5 000 ms
          validateResponse: validateLLMResponse,
        }
      ),
      5000 // ✅ Double protection via Promise.race
    );
  } catch (err: any) {
    const isTimeout =
      err?.message === "LLM timeout" ||
      (err?.message && err.message.toLowerCase().includes("timeout"));
    if (isTimeout) {
      logAITimeout("openai", { tenantId, model: AI_MODEL.DEFAULT });
      logger.warn("[LLM] Timeout détecté — retour du message de fallback", {
        module: "IA",
        tenantId,
      });
      // ✅ Retourner un résultat de fallback plutôt que de bloquer tRPC
      return {
        id: "fallback",
        created: Math.floor(Date.now() / 1000),
        model: AI_MODEL.DEFAULT,
        choices: [
          {
            message: {
              role: "assistant",
              content: LLM_TIMEOUT_FALLBACK,
            },
            finish_reason: "timeout_fallback",
            index: 0,
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      } ;
    }
    throw err;
  }

  // ✅ Observabilité : Enregistrement de la consommation et du coût estimé via le moniteur dédié
  if (result.usage) {
    await recordOpenAIUsage({
      tenantId,
      model: result.model,
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
    });
  }

  return result;
}

// Alias pour la compatibilité avec le code existant
export const generateChatCompletion = invokeLLM;
