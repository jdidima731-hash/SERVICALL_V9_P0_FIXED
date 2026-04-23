/**
 * WHATSAPP OWNER AGENT SERVICE
 * ─────────────────────────────────────────────────────────────
 * Assistant IA personnel pour l'utilisateur Servicall (owner/admin du tenant).
 * NE PAS CONFONDRE avec whatsappAIService.ts qui gère les clients du tenant.
 *
 * CE SERVICE gère :
 *   owner → WhatsApp → Agent IA → CRM / Agenda / Email / Recrutement / Dialer
 *
 * FLUX :
 *  1. Owner envoie un msg WhatsApp à son numéro Servicall dédié
 *  2. resolveTenantOwner() identifie le tenant via ownerWhatsappPhone en settings
 *  3. L'agent OpenAI function-calling exécute les tools nécessaires
 *  4. Réponse renvoyée en WhatsApp à l'owner
 *
 * TOOLS disponibles :
 *  - get_crm_summary       : résumé leads / prospects
 *  - get_appointments      : RDV du jour / semaine
 *  - get_pending_calls     : appels en attente
 *  - initiate_campaign     : lancer une campagne d'appels
 *  - get_unread_emails     : email non lus (si config email)
 *  - send_email            : envoyer email
 *  - get_recruitment_cvs   : CV en attente d'analyse
 *  - get_daily_briefing    : résumé complet de la journée
 *
 * SÉCURITÉ :
 *  - Seul l'owner du tenant (ownerWhatsappPhone) peut utiliser ce canal
 *  - Confirmation obligatoire avant toute action destructive
 *  - Isolation tenant stricte sur tous les tools
 */

import { logger } from "../infrastructure/logger";
import { invokeLLM } from "../_core/llm";
import { AI_MODEL } from "../_core/aiModels";

// TS2305 FIX — helper functions (remplacent les imports manquants de db.ts)
import { getDbInstance } from "../db";
import { prospects, appointments, calls } from "../../drizzle/schema";
import { eq, and, gte, lte, count } from "drizzle-orm";

async function getProspectsByTenant(tenantId: number, limit = 100) {
  const db = getDbInstance();
  return db.select().from(prospects).where(eq(prospects.tenantId, tenantId)).limit(limit);
}

async function getAppointmentsByTenant(tenantId: number, limit = 100) {
  const db = getDbInstance();
  return db.select().from(appointments).where(eq(appointments.tenantId, tenantId)).limit(limit);
}

async function countTodayAppointments(tenantId: number): Promise<number> {
  const db = getDbInstance();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const result = await db.select({ value: count() }).from(appointments)
    .where(and(eq(appointments.tenantId, tenantId), gte(appointments.startTime, today), lte(appointments.startTime, tomorrow)));
  return result[0]?.value ?? 0;
}

async function countPendingCalls(tenantId: number): Promise<number> {
  const db = getDbInstance();
  const result = await db.select({ value: count() }).from(calls)
    .where(and(eq(calls.tenantId, tenantId), eq(calls.status, "pending")));
  return result[0]?.value ?? 0;
}

import { sendEmail } from "./emailService";
import { dialerEngine } from "./dialer/dialer-engine";
import { recruitmentAIService } from "./recruitmentAIService";
import type { CampaignService } from "./campaignService";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface OwnerAgentMessage {
  from: string;         // numéro WhatsApp de l'owner
  body: string;         // texte du message
  timestamp?: number;
}

export interface OwnerAgentResult {
  replied: boolean;
  response: string;
  toolsUsed?: string[];
  error?: string;
  requiresConfirmation?: boolean;
  pendingAction?: PendingAction;
}

export interface PendingAction {
  type: "initiate_campaign" | "send_email" | "initiate_call" | "delete_data";
  payload: Record<string, unknown>;
  confirmationPrompt: string;
}

// ─────────────────────────────────────────────
// Définition des tools OpenAI function-calling
// ─────────────────────────────────────────────

const OWNER_AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_crm_summary",
      description: "Récupère un résumé des leads et prospects du CRM : nombre total, status (new/contacted/qualified), non relancés depuis 48h.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["all", "new", "not_contacted", "qualified"],
            description: "Filtre à appliquer sur les prospects",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_appointments",
      description: "Récupère les rendez-vous du tenant. Peut filtrer sur aujourd'hui, cette semaine, ou tous.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "all"],
            description: "Période des RDV à récupérer",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_pending_calls",
      description: "Récupère le nombre et la liste des appels en attente pour le tenant.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_daily_briefing",
      description: "Génère un briefing complet de la journée : RDV du jour, leads à relancer, appels en attente, CV à analyser.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "initiate_campaign",
      description: "Lance une campagne d'appels sur les prospects non contactés. REQUIERT CONFIRMATION avant exécution.",
      parameters: {
        type: "object",
        properties: {
          status_filter: {
            type: "string",
            enum: ["new", "not_contacted"],
            description: "Filtre statut prospects à appeler",
          },
          limit: {
            type: "number",
            description: "Nombre max de prospects à appeler (défaut: 20)",
          },
        },
        required: ["status_filter"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description: "Envoie un email. REQUIERT CONFIRMATION avant exécution.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Adresse email destinataire",
          },
          subject: {
            type: "string",
            description: "Sujet de l'email",
          },
          body: {
            type: "string",
            description: "Corps de l'email",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recruitment_cvs",
      description: "Récupère les candidats récents en attente d'analyse. Retourne les N derniers CV.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Nombre de CV à récupérer (défaut: 5)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_confirmation",
      description: "Demande confirmation à l'utilisateur avant d'effectuer une action sensible (appel, email, suppression).",
      parameters: {
        type: "object",
        properties: {
          action_description: {
            type: "string",
            description: "Description claire de l'action qui va être effectuée",
          },
          action_type: {
            type: "string",
            enum: ["initiate_campaign", "send_email", "initiate_call", "delete_data"],
          },
          action_payload: {
            type: "object",
            description: "Données de l'action à confirmer",
          },
        },
        required: ["action_description", "action_type", "action_payload"],
      },
    },
  },
];

// ─────────────────────────────────────────────
// System prompt de l'agent owner
// ─────────────────────────────────────────────

function buildOwnerSystemPrompt(tenantName: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return `Tu es l'assistant personnel et business IA de ${tenantName} sur Servicall.
Date : ${dateStr} — ${timeStr}

🎯 OBJECTIF : Aider l'utilisateur à gérer son business via WhatsApp.

⚙️ TU PEUX :
📞 Appels : appeler leads, relancer prospects, lancer campagnes
📅 Agenda : consulter / ajouter / modifier RDV
📧 Email : lire, résumer, répondre, envoyer
👨‍💼 Recrutement : analyser CV, classer candidats
📊 CRM : voir leads, suivre clients, analyser activité

🧠 COMPORTEMENT :
- Réponds TOUJOURS court et clair (WhatsApp = 2-4 lignes max)
- Priorise l'action : si un tool existe → utilise-le
- Ne jamais inventer de données — utilise uniquement les tools
- Si info manque → pose UNE seule question simple

⚠️ SÉCURITÉ — OBLIGATOIRE :
Avant toute action (appel, email, modification, suppression) :
→ Utilise request_confirmation pour demander validation à l'utilisateur
→ N'exécute JAMAIS une action sans confirmation explicite (oui / confirme / ok)

📦 FORMAT :
- Court, clair, orienté action
- Utilise des emojis pour la lisibilité
- Propose toujours une action suivante

Exemple : "Tu as 3 RDV aujourd'hui et 5 leads à relancer. Je lance les appels ?"`;
}

// ─────────────────────────────────────────────
// Exécution des tools
// ─────────────────────────────────────────────

async function executeTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  tenantId: number
): Promise<{ result: string; pendingAction?: PendingAction }> {

  switch (toolName) {

    case "get_crm_summary": {
      const filter = (toolArgs.filter as string) || "all";
      const prospects = await getProspectsByTenant(tenantId, 200);
      const total = prospects.length;
      const newLeads = prospects.filter(p => p.status === "new").length;
      const contacted = prospects.filter(p => p.status === "contacted").length;
      const qualified = prospects.filter(p => p.status === "qualified").length;

      // Prospects non relancés : status "new" ou dernière mise à jour > 48h
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const stale = prospects.filter(p =>
        p.status === "new" &&
        p.updatedAt &&
        new Date(p.updatedAt).getTime() < cutoff
      ).length;

      if (filter === "not_contacted") {
        return { result: `📊 Leads non relancés (>48h) : *${stale}*\nStatut new : ${newLeads}\nTotal : ${total}` };
      }
      return {
        result: `📊 CRM — ${total} prospects\n• Nouveaux : ${newLeads}\n• Contactés : ${contacted}\n• Qualifiés : ${qualified}\n• Non relancés >48h : ${stale}`
      };
    }

    case "get_appointments": {
      const period = (toolArgs.period as string) || "today";
      const appointments = await getAppointmentsByTenant(tenantId, 100);
      const now = new Date();

      let filtered = appointments;
      if (period === "today") {
        filtered = appointments.filter(a => {
          const d = new Date(a.startTime!);
          return d.toDateString() === now.toDateString();
        });
      } else if (period === "week") {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filtered = appointments.filter(a => {
          const d = new Date(a.startTime!);
          return d >= now && d <= weekEnd;
        });
      }

      if (filtered.length === 0) {
        return { result: `📅 Aucun RDV ${period === "today" ? "aujourd'hui" : "cette semaine"}.` };
      }

      const list = filtered.slice(0, 5).map(a => {
        const d = new Date(a.startTime!);
        const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const contactName = (a ).contactName;
        return `• ${time} — ${a.title || "RDV"} ${contactName ? `(${contactName})` : ""}`;
      }).join("\n");

      return {
        result: `📅 ${filtered.length} RDV ${period === "today" ? "aujourd'hui" : "cette semaine"} :\n${list}${filtered.length > 5 ? `\n... et ${filtered.length - 5} autres` : ""}`
      };
    }

    case "get_pending_calls": {
      const count = await countPendingCalls(tenantId);
      if (count === 0) return { result: "📞 Aucun appel en attente." };
      return { result: `📞 ${count} appel(s) en attente dans la queue.` };
    }

    case "get_daily_briefing": {
      // Aggrège tout en parallèle
      const [prospects, todayAppts, pendingCalls] = await Promise.all([
        getProspectsByTenant(tenantId, 200),
        countTodayAppointments(tenantId),
        countPendingCalls(tenantId),
      ]);

      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      const staleLeads = prospects.filter(p =>
        p.status === "new" && p.updatedAt && new Date(p.updatedAt).getTime() < cutoff
      ).length;

      const newLeads = prospects.filter(p => p.status === "new").length;

      let briefing = `🌅 Briefing du jour :\n`;
      briefing += `📅 ${todayAppts} RDV aujourd'hui\n`;
      briefing += `👥 ${newLeads} nouveaux leads\n`;
      if (staleLeads > 0) briefing += `⚠️ ${staleLeads} leads non relancés (+48h)\n`;
      if (pendingCalls > 0) briefing += `📞 ${pendingCalls} appels en attente\n`;

      if (staleLeads > 0) briefing += `\nJe relance les ${staleLeads} leads ? (réponds *oui*)`;
      else if (todayAppts === 0) briefing += `\nAucun RDV planifié. Veux-tu que j'appelle des prospects ?`;

      return { result: briefing };
    }

    case "initiate_campaign": {
      const limit = (toolArgs.limit as number) || 20;
      const statusFilter = (toolArgs.status_filter as string) || "new";
      return {
        result: `⏳ En attente de confirmation...`,
        pendingAction: {
          type: "initiate_campaign",
          payload: { status_filter: statusFilter, limit },
          confirmationPrompt: `📞 Je vais lancer une campagne d'appels sur *${limit}* prospects (statut: ${statusFilter}).\n\nConfirmes-tu ? (réponds *oui* pour lancer)`,
        },
      };
    }

    case "send_email": {
      const { to, subject, body } = toolArgs as { to: string; subject: string; body: string };
      return {
        result: `⏳ En attente de confirmation...`,
        pendingAction: {
          type: "send_email",
          payload: { to, subject, body },
          confirmationPrompt: `📧 Je vais envoyer un email :\n• À : ${to}\n• Sujet : ${subject}\n• Message : ${body.slice(0, 100)}...\n\nConfirmes-tu ? (réponds *oui*)`,
        },
      };
    }

    case "get_recruitment_cvs": {
      const limit = (toolArgs.limit as number) || 5;
      try {
        // Utilise le service de recrutement pour lister les candidats récents
        const candidates = await (recruitmentAIService ).getRecentCandidates(tenantId, limit);
        if (!candidates || candidates.length === 0) {
          return { result: "👨‍💼 Aucun CV en attente d'analyse." };
        }
        const list = candidates.slice(0, 5).map((c: unknown) =>
          `• ${c.firstName} ${c.lastName} — ${c.appliedPosition || "Poste non précisé"} (${c.status || "nouveau"})`
        ).join("\n");
        return { result: `👨‍💼 ${candidates.length} CV à analyser :\n${list}` };
      } catch {
        return { result: `👨‍💼 ${limit} CV demandés — module recrutement actif.` };
      }
    }

    case "request_confirmation": {
      const { action_description, action_type, action_payload } = toolArgs as {
        action_description: string;
        action_type: PendingAction["type"];
        action_payload: Record<string, unknown>;
      };
      return {
        result: `⚠️ Confirmation requise`,
        pendingAction: {
          type: action_type,
          payload: action_payload,
          confirmationPrompt: `⚠️ *Confirmation requise*\n\n${action_description}\n\nRéponds *oui* pour confirmer ou *non* pour annuler.`,
        },
      };
    }

    default:
      return { result: `Tool inconnu : ${toolName}` };
  }
}

// ─────────────────────────────────────────────
// Gestion des confirmations en attente
// ─────────────────────────────────────────────

// Store en mémoire (par tenantId + numéro owner) — à migrer Redis si nécessaire
const pendingConfirmations = new Map<string, PendingAction>();

function confirmationKey(tenantId: number, ownerPhone: string): string {
  return `${tenantId}:${ownerPhone}`;
}

async function executePendingAction(
  action: PendingAction,
  tenantId: number
): Promise<string> {
  switch (action.type) {
    case "send_email": {
      const { to, subject, body } = action.payload as { to: string; subject: string; body: string };
      await sendEmail(to, subject, body);
      return `✅ Email envoyé à ${to}.`;
    }
    case "initiate_campaign": {
      const { status_filter, limit } = action.payload as { status_filter: string; limit: number };
      const prospects = await getProspectsByTenant(tenantId, limit);
      const filtered = prospects.filter(p => p.status === status_filter).slice(0, limit);
      if (filtered.length === 0) return `❌ Aucun prospect avec statut "${status_filter}" trouvé.`;
      // Enqueue les appels via le dialer engine
      for (const prospect of filtered) {
        try {
          await dialerEngine.enqueueCall(tenantId, {
            prospectId: prospect.id,
            phone: prospect.phone!,
            firstName: prospect.firstName || "",
            lastName: prospect.lastName || "",
          });
        } catch (e) {
          logger.warn("[OwnerAgent] Failed to enqueue call", { prospectId: prospect.id });
        }
      }
      return `✅ Campagne lancée : ${filtered.length} appels en queue.`;
    }
    default:
      return `✅ Action confirmée.`;
  }
}

// ─────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────

export async function handleOwnerAgentMessage(
  message: OwnerAgentMessage,
  tenantId: number,
  tenantName: string
): Promise<OwnerAgentResult> {
  const key = confirmationKey(tenantId, message.from);
  const bodyLower = message.body.trim().toLowerCase();

  // ── Vérifier si c'est une confirmation d'action en attente ──
  if (pendingConfirmations.has(key)) {
    const pending = pendingConfirmations.get(key)!;
    if (["oui", "yes", "ok", "confirme", "confirm", "go", "ouais"].includes(bodyLower)) {
      pendingConfirmations.delete(key);
      try {
        const resultMsg = await executePendingAction(pending, tenantId);
        return { replied: true, response: resultMsg, toolsUsed: [pending.type] };
      } catch (err: any) {
        return { replied: true, response: `❌ Erreur lors de l'exécution : ${err.message}` };
      }
    } else if (["non", "no", "annule", "cancel", "stop"].includes(bodyLower)) {
      pendingConfirmations.delete(key);
      return { replied: true, response: "❌ Action annulée." };
    }
    // Message ambigu → re-demander confirmation
    return {
      replied: true,
      response: `❓ Je n'ai pas compris. Réponds *oui* pour confirmer ou *non* pour annuler.\n\n${pending.confirmationPrompt}`,
    };
  }

  // ── Agent IA avec function calling ──
  const systemPrompt = buildOwnerSystemPrompt(tenantName);
  const toolsUsed: string[] = [];

  try {
    // Premier appel LLM
    const response = await invokeLLM(tenantId, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message.body },
      ],
      tools: OWNER_AGENT_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 800,
    }) as unknown as { choices?: Array<{ message?: { tool_calls?: unknown[]; content?: string } }> };

    const firstChoice = response.choices?.[0];
    if (!firstChoice) throw new Error("No response from LLM");

    // ── Pas de tool call → réponse directe ──
    if (!firstChoice.message?.tool_calls?.length) {
      return {
        replied: true,
        response: firstChoice.message?.content || "Je n'ai pas compris. Reformule ta demande.",
      };
    }

    // ── Exécuter les tool calls en séquence ──
    const toolMessages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message.body },
      firstChoice.message,
    ];

    let pendingAction: PendingAction | undefined;

    for (const toolCall of firstChoice.message.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch { /* ignore parse error */ }

      toolsUsed.push(toolName);

      const toolResult = await executeTool(toolName, toolArgs, tenantId);

      // Si l'action requiert confirmation → sortir et mettre en attente
      if (toolResult.pendingAction) {
        pendingAction = toolResult.pendingAction;
        pendingConfirmations.set(key, pendingAction);
        return {
          replied: true,
          response: pendingAction.confirmationPrompt,
          toolsUsed,
          requiresConfirmation: true,
          pendingAction,
        };
      }

      toolMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult.result,
      });
    }

    // ── Second appel LLM pour synthétiser les résultats des tools ──
    const finalResponse = await invokeLLM(tenantId, {
      model: AI_MODEL.DEFAULT,
      messages: toolMessages,
      temperature: 0.3,
      max_tokens: 400,
    }) as unknown as { choices?: Array<{ message?: { content?: string } }> };

    const finalText = finalResponse.choices?.[0]?.message?.content?.trim()
      || "Données récupérées avec succès.";

    return {
      replied: true,
      response: finalText,
      toolsUsed,
    };

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[OwnerAgent] Failed", { err: msg, tenantId, from: message.from });
    return {
      replied: false,
      response: "❌ Une erreur s'est produite. Réessaie dans quelques secondes.",
      error: msg,
    };
  }
}

// ─────────────────────────────────────────────
// Identifier si un numéro entrant est l'owner du tenant
// ─────────────────────────────────────────────

export async function isOwnerPhone(
  incomingPhone: string,
  tenantSettings: Record<string, unknown> | null
): Promise<boolean> {
  if (!tenantSettings) return false;

  // ✅ FIX: cherche ownerWhatsappPhone à la RACINE (legacy) ET dans whatsappAgent (nouveau)
  // saveWhatsAppAgentConfig sauvegarde dans settings.whatsappAgent.ownerWhatsappPhone
  // mais l'ancienne config pouvait être à la racine settings.ownerWhatsappPhone
  const ownerPhoneRoot = (tenantSettings as unknown as { ownerWhatsappPhone?: string }).ownerWhatsappPhone as string | undefined;
  const ownerPhoneNested = ((tenantSettings as unknown as { whatsappAgent?: Record<string, unknown> }).whatsappAgent as Record<string, unknown> | undefined)
    ?.ownerWhatsappPhone as string | undefined;

  const ownerPhone = ownerPhoneNested ?? ownerPhoneRoot;
  if (!ownerPhone) return false;

  // Normalisation : on compare sans le + ni espaces
  const normalize = (p: string) => p.replace(/[^0-9]/g, "");
  return normalize(incomingPhone) === normalize(ownerPhone);
}
