/**
 * AI MEMORY SERVICE — Mémoire conversationnelle longue durée
 * ─────────────────────────────────────────────────────────────
 * L'agent IA se souvient de chaque client : dernier appel, préférences,
 * problèmes non résolus, promesses faites, humeur détectée.
 *
 * Architecture :
 *  - Stockage en DB (table ai_memories) — persistant sans dépendance externe
 *  - Résumés compressés générés par LLM après chaque interaction
 *  - Récupération par tenantId + identifiant contact (phone/email/prospectId)
 *  - Injection automatique dans le context prompt de chaque appel/message
 */

import { getDbInstance } from "../db";
import { invokeLLM, type InvokeResult } from "../_core/llm";
import { AI_MODEL } from "../_core/aiModels";
import { logger } from "../infrastructure/logger";
import { aiMemories } from "../../drizzle/schema-ai";
import { eq, and, desc, lt } from "drizzle-orm";
import { KeyFactsSchema, type KeyFacts } from "../../shared/validation/ai";
import { z } from "zod";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MemoryEntry {
  id?: number;
  tenantId: number;
  contactIdentifier: string;  // phone, email, ou prospectId.toString()
  contactName?: string;
  channel: "call" | "whatsapp" | "sms" | "email" | "chat";
  summary: string;            // Résumé compressé de l'interaction
  keyFacts: KeyFacts;
  interactionDate: Date;
  createdAt?: Date;
}

export interface ConversationContext {
  hasMemory: boolean;
  contactName?: string;
  memoryPrompt: string;       // Prêt à injecter dans le system prompt
  recentSummaries: string[];
  keyFacts: KeyFacts;
  totalInteractions: number;
}

// ─────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────

/**
 * Récupère le contexte mémorisé d'un contact pour injection dans le prompt IA
 */
export async function getContactMemory(
  tenantId: number,
  contactIdentifier: string,
  limit: number = 5
): Promise<ConversationContext> {
  const db = getDbInstance();
  try {
    const results = await db.select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.tenantId, tenantId),
          eq(aiMemories.contactIdentifier, contactIdentifier)
        )
      )
      .orderBy(desc(aiMemories.interactionDate))
      .limit(limit);

    if (results.length === 0) {
      return {
        hasMemory: false,
        memoryPrompt: "",
        recentSummaries: [],
        keyFacts: {},
        totalInteractions: 0,
      };
    }

    // Agréger les key_facts de toutes les interactions
    const aggregatedFacts: any = {
      preferences: [],
      issues: [],
      promises: [],
    };

    let lastSentiment: string | undefined;
    let lastLanguage: string | undefined;
    let lastOutcome: string | undefined;
    let contactName: string | undefined;

    for (const m of results) {
      const facts = KeyFactsSchema.parse(m.keyFacts || {});

      if (Array.isArray(facts.preferences)) aggregatedFacts.preferences.push(...facts.preferences);
      if (Array.isArray(facts.issues)) aggregatedFacts.issues.push(...facts.issues);
      if (Array.isArray(facts.promises)) aggregatedFacts.promises.push(...facts.promises);
      
      if (!lastSentiment && typeof facts.sentiment === 'string') lastSentiment = facts.sentiment;
      if (!lastLanguage && typeof facts.language === 'string') lastLanguage = facts.language;
      if (!lastOutcome && typeof facts.lastOutcome === 'string') lastOutcome = facts.lastOutcome;
      if (!contactName && m.contactName) contactName = m.contactName;
    }

    // Dédupliquer et limiter
    aggregatedFacts.preferences = [...new Set(aggregatedFacts.preferences)].slice(0, 5);
    aggregatedFacts.issues = [...new Set(aggregatedFacts.issues)].slice(0, 5);
    aggregatedFacts.promises = [...new Set(aggregatedFacts.promises)].slice(0, 3);
    aggregatedFacts.sentiment = lastSentiment;
    aggregatedFacts.language = lastLanguage;
    aggregatedFacts.lastOutcome = lastOutcome;

    const recentSummaries = results.slice(0, 3).map((m) => {
      const date = m.interactionDate.toLocaleDateString("fr-FR");
      return `[${date} via ${m.channel}] ${m.summary}`;
    });

    // Construire le prompt mémoire
    const memoryPrompt = buildMemoryPrompt(contactName, recentSummaries, aggregatedFacts);

    return {
      hasMemory: true,
      contactName,
      memoryPrompt,
      recentSummaries,
      keyFacts: aggregatedFacts,
      totalInteractions: results.length,
    };
  } catch (err: unknown) {
    logger.error("[AIMemory] Failed to retrieve memory", { 
      err: err instanceof Error ? err.message : String(err), 
      tenantId, 
      contactIdentifier 
    });
    return {
      hasMemory: false,
      memoryPrompt: "",
      recentSummaries: [],
      keyFacts: {},
      totalInteractions: 0,
    };
  }
}

/**
 * Sauvegarde une nouvelle interaction en mémoire
 */
export async function saveInteractionMemory(params: {
  tenantId: number;
  contactIdentifier: string;
  contactName?: string;
  channel: MemoryEntry["channel"];
  transcript?: string;
  manualSummary?: string;
  keyFacts?: KeyFacts;
}): Promise<void> {
  const db = getDbInstance();
  try {
    let summary = params.manualSummary ?? "";
    let keyFacts = KeyFactsSchema.parse(params.keyFacts ?? {});

    if (params.transcript && params.transcript.length > 50) {
      const result = await generateMemorySummary(
        params.transcript,
        params.tenantId,
        params.channel
      );
      summary = result.summary;
      keyFacts = { ...keyFacts, ...result.keyFacts };
    }

    if (!summary) {
      summary = `Interaction ${params.channel} enregistrée`;
    }

    await db.insert(aiMemories).values({
      tenantId: params.tenantId,
      contactIdentifier: params.contactIdentifier,
      contactName: params.contactName,
      channel: params.channel,
      summary: summary,
      keyFacts: keyFacts,
      interactionDate: new Date(),
    });

    logger.info("[AIMemory] Interaction saved", {
      tenantId: params.tenantId,
      contact: params.contactIdentifier,
      channel: params.channel,
    });
  } catch (err: unknown) {
    logger.error("[AIMemory] Failed to save memory", { 
      err: err instanceof Error ? err.message : String(err) 
    });
  }
}

/**
 * Supprime toutes les mémoires d'un contact (RGPD - droit à l'oubli)
 */
export async function deleteContactMemory(
  tenantId: number,
  contactIdentifier: string
): Promise<number> {
  const db = getDbInstance();
  try {
    const result = await db.delete(aiMemories)
      .where(
        and(
          eq(aiMemories.tenantId, tenantId),
          eq(aiMemories.contactIdentifier, contactIdentifier)
        )
      )
      .returning({ id: aiMemories.id });

    logger.info("[AIMemory] RGPD deletion completed", { tenantId, contactIdentifier, count: result.length });
    return result.length;
  } catch (err: unknown) {
    logger.error("[AIMemory] Failed to delete memory", { 
      err: err instanceof Error ? err.message : String(err) 
    });
    return 0;
  }
}

/**
 * Purge les mémoires plus vieilles que N jours (RGPD rétention)
 */
export async function purgeOldMemories(
  tenantId: number,
  retentionDays: number = 365
): Promise<number> {
  const db = getDbInstance();
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await db.delete(aiMemories)
      .where(
        and(
          eq(aiMemories.tenantId, tenantId),
          lt(aiMemories.interactionDate, cutoff)
        )
      )
      .returning({ id: aiMemories.id });

    logger.info("[AIMemory] Old memories purged", { tenantId, retentionDays, count: result.length });
    return result.length;
  } catch (err: unknown) {
    logger.error("[AIMemory] Failed to purge old memories", { 
      err: err instanceof Error ? err.message : String(err) 
    });
    return 0;
  }
}

// ─────────────────────────────────────────────
// Private Helpers
// ─────────────────────────────────────────────

async function generateMemorySummary(
  transcript: string,
  tenantId: number,
  channel: string
): Promise<{ summary: string; keyFacts: KeyFacts }> {
  try {
    const response = (await invokeLLM(tenantId, {
      model: AI_MODEL.DEFAULT,
      messages: [
        {
          role: "system",
          content: `Tu es un assistant qui crée des résumés concis d'interactions client.
          Réponds UNIQUEMENT avec un objet JSON valide contenant:
          - summary: string (max 200 caractères)
          - keyFacts: { preferences: string[], issues: string[], promises: string[], sentiment: "positive"|"neutral"|"negative", language: string, lastOutcome: string }`
        },
        { role: "user", content: `Transcript (${channel}):\n${transcript}` as unknown }
      ],
      response_format: { type: "json_object" }
    })) as InvokeResult;

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = JSON.parse(content);
    return {
      summary: String(parsed.summary),
      keyFacts: KeyFactsSchema.parse(parsed.keyFacts)
    };
  } catch (err: unknown) {
    logger.warn("[AIMemory] Failed to generate AI summary, using fallback", { err });
    return {
      summary: transcript.substring(0, 150) + "...",
      keyFacts: {}
    };
  }
}

function buildMemoryPrompt(
  name: string | undefined,
  summaries: string[],
  facts: KeyFacts
): string {
  let prompt = `\n--- MÉMOIRE DU CONTACT ---\n`;
  if (name) prompt += `Nom : ${name}\n`;
  
  if (summaries.length > 0) {
    prompt += `Dernières interactions :\n${summaries.map(s => "- " + s).join("\n")}\n`;
  }

  const f = facts as unknown;
  if (f.preferences?.length) prompt += `Préférences : ${f.preferences.join(", ")}\n`;
  if (f.issues?.length) prompt += `Problèmes connus : ${f.issues.join(", ")}\n`;
  if (f.promises?.length) prompt += `Promesses faites : ${f.promises.join(", ")}\n`;
  if (f.sentiment) prompt += `Humeur habituelle : ${f.sentiment}\n`;
  
  prompt += `--------------------------\n`;
  return prompt;
}
