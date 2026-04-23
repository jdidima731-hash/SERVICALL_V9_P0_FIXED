/**
 * DIALOGUE SCENARIO REPOSITORY
 * ─────────────────────────────────────────────────────────────
 * Charge les scénarios de dialogue depuis la base de données.
 *
 * Stratégie de résolution (ordre de priorité) :
 *   1. Table `dialogue_scenarios` si elle existe (future)
 *   2. Table `workflows` — champ `actions` contient les étapes
 *      dont on dérive un DialogueScenario
 *   3. Template industrie depuis INDUSTRY_TEMPLATES (fallback statique)
 *   4. Scénario minimal générique (dernier recours)
 *
 * Résultats mis en cache Redis (TTL 5min) pour éviter des requêtes DB
 * à chaque tour de conversation.
 */

import { eq, and } from "drizzle-orm";
import { getDbInstance } from "../db";
import { workflows } from "../../drizzle/schema";
import { getRedisClient } from "../infrastructure/redis/redis.client";
import { logger } from "../infrastructure/logger";
import type { DialogueScenario, DialogueState } from "../../shared/types/dialogue";
import { ALL_TEMPLATES as INDUSTRY_TEMPLATES } from "../workflow-engine/templates/industryTemplates";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_PREFIX = "dialogue_scenario:";

// ─── Scénario générique de dernier recours ────────────────────────────────────

function buildGenericScenario(scenarioId: string, systemPrompt: string): DialogueScenario {
  return {
    id: scenarioId,
    name: "Scénario Générique",
    industry: "generic",
    initialState: "greeting",
    fallbackState: "fallback",
    context: { systemPrompt },
    states: [
      {
        id: "greeting",
        name: "Accueil",
        onEnter: [
          {
            type: "speak_to_caller",
            config: { text: "Bonjour, je suis votre assistant virtuel. Comment puis-je vous aider ?" },
          },
        ],
        transitions: [{ condition: "true", targetState: "main" }],
      },
      {
        id: "main",
        name: "Traitement principal",
        onEnter: [],
        transitions: [{ condition: "true", targetState: "closing" }],
      },
      {
        id: "closing",
        name: "Clôture",
        onEnter: [
          {
            type: "speak_to_caller",
            config: { text: "Merci pour votre appel. Bonne journée !" },
          },
        ],
        transitions: [],
      },
      {
        id: "fallback",
        name: "Incompréhension",
        isFallback: true,
        onEnter: [
          {
            type: "speak_to_caller",
            config: { text: "Je n'ai pas bien compris. Pouvez-vous reformuler ?" },
          },
        ],
        transitions: [{ condition: "true", targetState: "main" }],
      },
    ],
  };
}

// ─── Conversion workflow steps → DialogueScenario ────────────────────────────

function workflowActionsToScenario(
  workflowId: string,
  workflowName: string,
  industry: string,
  actions: unknown[],
  systemPrompt: string
): DialogueScenario {
  const states: DialogueState[] = [];

  // Convertit chaque étape en état de dialogue
  for (let i = 0; i < actions.length; i++) {
    const step = actions[i] as Record<string, unknown>;
    const stepId = (step["id"] as string) ?? `step_${i}`;
    const nextStepId =
      i < actions.length - 1
        ? ((actions[i + 1] as Record<string, unknown>)?.["id"] as string) ?? `step_${i + 1}`
        : "closing";

    const actionType = (step["action_type"] ?? step["type"]) as string;
    const config = (step["config"] as Record<string, unknown>) ?? {};

    states.push({
      id: stepId,
      name: (step["name"] as string) ?? stepId,
      onEnter: [{ type: actionType, config }],
      transitions: [{ condition: "true", targetState: nextStepId }],
    });
  }

  // État de clôture
  states.push({
    id: "closing",
    name: "Clôture",
    onEnter: [
      {
        type: "speak_to_caller",
        config: { text: "Merci pour votre appel. À bientôt !" },
      },
    ],
    transitions: [],
  });

  // État de fallback
  states.push({
    id: "fallback",
    name: "Incompréhension",
    isFallback: true,
    onEnter: [
      {
        type: "speak_to_caller",
        config: { text: "Je n'ai pas bien compris. Pouvez-vous répéter ?" },
      },
    ],
    transitions: [{ condition: "true", targetState: states[0]?.id ?? "fallback" }],
  });

  return {
    id: workflowId,
    name: workflowName,
    industry,
    initialState: states[0]?.id ?? "fallback",
    fallbackState: "fallback",
    context: { systemPrompt },
    states,
  };
}

// ─── Repository principal ─────────────────────────────────────────────────────

export class DialogueScenarioRepository {
  /**
   * Charge un scénario par son ID pour un tenant donné.
   * Cherche dans : Redis cache → DB workflows → templates → générique.
   */
  static async findById(
    scenarioId: string,
    tenantId: number,
    systemPrompt: string
  ): Promise<DialogueScenario> {
    const cacheKey = `${CACHE_PREFIX}${tenantId}:${scenarioId}`;

    // 1. Cache Redis
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("[ScenarioRepo] Cache hit", { scenarioId, tenantId });
        return JSON.parse(cached) as DialogueScenario;
      }
    } catch {
      // Redis indisponible → on continue
    }

    // 2. Chercher dans la table workflows (le scenarioId peut être l'id ou le nom du workflow)
    try {
      const db = getDbInstance();
      const rows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.tenantId, tenantId),
            eq(workflows.isActive, true)
          )
        )
        .limit(20);

      // Chercher par ID exact, puis par nom
      const match =
        rows.find((w) => String(w.id) === scenarioId) ??
        rows.find((w) => w.name?.toLowerCase().includes(scenarioId.toLowerCase()));

      if (match) {
        const actions = Array.isArray(match.actions)
          ? match.actions
          : (() => {
              try {
                return JSON.parse(match.actions as string);
              } catch {
                return [];
              }
            })();

        
        const industry = ((match as unknown).industry as string) ?? "generic";
        const scenario = workflowActionsToScenario(
          String(match.id),
          match.name ?? scenarioId,
          industry,
          actions,
          systemPrompt
        );

        await DialogueScenarioRepository.cacheScenario(cacheKey, scenario);
        logger.info("[ScenarioRepo] Scenario loaded from workflow", { scenarioId, workflowId: match.id, tenantId });
        return scenario;
      }
    } catch (err: any) {
      logger.warn("[ScenarioRepo] DB lookup failed", { err, scenarioId, tenantId });
    }

    // 3. Chercher dans les templates industrie
    const template = INDUSTRY_TEMPLATES.find(
      (t: any) => (t as unknown).industry === scenarioId || t.name.toLowerCase().includes(scenarioId.toLowerCase())
    );

    if (template) {
      const scenario = workflowActionsToScenario(
        scenarioId,
        template.name,
        (template as unknown).industry,
        (template as unknown).steps as unknown[],
        systemPrompt
      );
      await DialogueScenarioRepository.cacheScenario(cacheKey, scenario);
      logger.info("[ScenarioRepo] Scenario loaded from industry template", { scenarioId, industry: (template as unknown).industry });
      return scenario;
    }

    // 4. Scénario générique de dernier recours
    logger.warn("[ScenarioRepo] No scenario found, using generic fallback", { scenarioId, tenantId });
    const generic = buildGenericScenario(scenarioId, systemPrompt);
    await DialogueScenarioRepository.cacheScenario(cacheKey, generic);
    return generic;
  }

  private static async cacheScenario(key: string, scenario: DialogueScenario): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.set(key, JSON.stringify(scenario), "EX", CACHE_TTL_SECONDS);
    } catch {
      // Cache non critique
    }
  }

  /**
   * Invalide le cache pour un tenant (utile après mise à jour d'un workflow)
   */
  static async invalidateCache(tenantId: number, scenarioId?: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const pattern = scenarioId
        ? `${CACHE_PREFIX}${tenantId}:${scenarioId}`
        : `${CACHE_PREFIX}${tenantId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info("[ScenarioRepo] Cache invalidated", { tenantId, scenarioId, count: keys.length });
      }
    } catch {
      // Non critique
    }
  }
}