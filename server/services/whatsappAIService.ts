/**
 * WHATSAPP AI DIALOGUE SERVICE
 * ─────────────────────────────────────────────────────────────
 * Gère les conversations WhatsApp entrantes avec l'IA.
 * Le client envoie un message → l'IA répond intelligemment
 * en tenant compte du métier du tenant, de la mémoire du contact,
 * et de la langue détectée automatiquement.
 */

import { invokeLLM } from "../_core/llm";
import { AI_MODEL } from "../_core/aiModels";
import { logger } from "../infrastructure/logger";
import { getContactMemory, saveInteractionMemory } from "./aiMemoryService";
import { generateTenantSystemPrompt } from "./tenantIndustryService";
import { sendWhatsAppUnified } from "./whatsappCommonService";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface WhatsAppMessage {
  from: string;         // numéro WhatsApp expéditeur (format: +21298...)
  to: string;           // numéro WhatsApp destinataire (votre numéro)
  body: string;         // contenu du message
  messageId: string;    // ID unique Meta
  timestamp: number;    // Unix timestamp
  type: "text" | "audio" | "image" | "document" | "location";
  profileName?: string; // Nom du contact WhatsApp
}

export interface WhatsAppDialogueResult {
  replied: boolean;
  response?: string;
  language?: string;
  memoryUsed?: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Détection de langue MENA
// ─────────────────────────────────────────────

const ARABIC_REGEX = /[\u0600-\u06FF]/;
const DARIJA_KEYWORDS = /wach|bghit|labas|mashi|wakha|daba|mzyan|zwina|smiyti|dial/i;
const TUNISIAN_KEYWORDS = /chkoun|chbik|barcha|mrigel|barka|yaaser|ki|nakol|nheb/i;
const ALGERIAN_KEYWORDS = /wach|rabi|nta|ntiya|khoya|sahbi|chhal|bezzaf|lazem/i;
const FRENCH_REGEX = /\b(je|tu|il|nous|vous|ils|le|la|les|un|une|est|sont|avec|pour|dans)\b/i;

export function detectLanguage(text: string): string {
  if (ARABIC_REGEX.test(text)) return "ar";
  if (DARIJA_KEYWORDS.test(text)) return "dar"; // Darija marocain
  if (TUNISIAN_KEYWORDS.test(text)) return "tun"; // Tunisien
  if (ALGERIAN_KEYWORDS.test(text)) return "alg"; // Algérien
  if (FRENCH_REGEX.test(text)) return "fr";
  return "fr"; // défaut
}

function getLanguageInstruction(lang: string): string {
  const map: Record<string, string> = {
    ar:  "Réponds en arabe standard (fusha) avec un ton professionnel.",
    dar: "Réponds en darija marocain de manière naturelle et chaleureuse. Tu peux mélanger français et darija si c'est plus naturel.",
    tun: "Réponds en dialecte tunisien de manière naturelle. Tu peux utiliser le français quand c'est plus clair.",
    alg: "Réponds en dialecte algérien de manière naturelle. Mélange arabe et français comme c'est naturel en Algérie.",
    fr:  "Réponds en français de manière professionnelle et chaleureuse.",
    en:  "Reply in English, professional and friendly tone.",
  };
  return map[lang] ?? map.fr;
}

// ─────────────────────────────────────────────
// Envoi WhatsApp (Délégué au service commun)
// ─────────────────────────────────────────────

async function sendWhatsAppReply(
  to: string,
  message: string,
  tenantConfig: { wabaPhoneNumberId?: string; wabaAccessToken?: string; twilioSid?: string; twilioToken?: string; twilioPhone?: string }
): Promise<boolean> {
  return sendWhatsAppUnified(to, message, tenantConfig);
}

// ─────────────────────────────────────────────
// Agent Tools Definition
// ─────────────────────────────────────────────

const VENDOR_AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "check_stock",
      description: "Vérifie la disponibilité et le prix d'un produit ou service dans le catalogue du commerçant. Utiliser dès qu'un client demande un produit, une pièce, un article ou un service.",
      parameters: {
        type: "object",
        properties: {
          search_term: {
            type: "string",
            description: "Nom ou description du produit recherché (ex: 'filtre à huile Renault Clio 2019', 'pizza margherita', 'RAM 8Go DDR4')"
          },
          entity_type: {
            type: "string",
            description: "Type d'entité: 'product' (pièce/article), 'service', 'dish' (plat), 'medication' (médicament)",
            enum: ["product", "service", "dish", "medication"]
          }
        },
        required: ["search_term"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_order",
      description: "Crée une commande après confirmation explicite du client. NE PAS appeler sans confirmation du client.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nom exact du produit commandé" },
          quantity: { type: "number", description: "Quantité commandée" },
          unit_price: { type: "number", description: "Prix unitaire en euros" },
          customer_phone: { type: "string", description: "Numéro WhatsApp du client" },
          delivery_address: { type: "string", description: "Adresse de livraison si applicable" },
          notes: { type: "string", description: "Notes spéciales (couleur, taille, modèle véhicule...)" }
        },
        required: ["product_name", "quantity", "unit_price"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "request_payment",
      description: "Génère un lien de paiement Stripe sécurisé à envoyer au client. Appeler uniquement après création de commande.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Montant total en euros" },
          description: { type: "string", description: "Description affichée sur la page de paiement" },
          customer_phone: { type: "string", description: "Numéro WhatsApp du client pour référence" }
        },
        required: ["amount", "description"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_order_status",
      description: "Récupère le statut d'une commande existante d'un client.",
      parameters: {
        type: "object",
        properties: {
          customer_phone: { type: "string", description: "Numéro WhatsApp du client" },
          order_reference: { type: "string", description: "Référence de commande si connue (optionnel)" }
        },
        required: ["customer_phone"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "suggest_upsell",
      description: "Propose des produits complémentaires après une vente ou une consultation. Utiliser après create_order ou après check_stock.",
      parameters: {
        type: "object",
        properties: {
          base_product: { type: "string", description: "Produit principal acheté ou consulté" },
          category: { type: "string", description: "Catégorie pour les suggestions complémentaires" }
        },
        required: ["base_product"]
      }
    }
  }
];

async function executeVendorTool(
  toolName: string,
  toolArgs: Record<string, any>,
  tenantId: number,
  customerPhone: string
): Promise<string> {
  try {
    switch (toolName) {
      case "check_stock": {
        const { businessKnowledgeService } = await import("./BusinessKnowledgeService");
        const results = await businessKnowledgeService.searchEntities(
          tenantId,
          toolArgs.search_term,
          toolArgs.entity_type
        );
        if (!results || results.length === 0) {
          return JSON.stringify({ available: false, message: `Produit "${toolArgs.search_term}" non trouvé dans le catalogue.` });
        }
        const item = results[0];
        return JSON.stringify({
          available: item.isActive !== false,
          name: item.title,
          price: item.price,
          description: item.description,
          stock_info: item.availabilityJson ?? "En stock",
          all_results: results.slice(0, 3).map((r: any) => ({ name: r.title, price: r.price }))
        });
      }

      case "create_order": {
        const { OrderService } = await import("./orderService");
        const order = await OrderService.createOrder({
          tenantId,
          prospectId: undefined,
          orderNumber: `WA-${Date.now()}`,
          items: [{
            name: toolArgs.product_name,
            quantity: toolArgs.quantity,
            unitPrice: toolArgs.unit_price,
          }],
          totalAmount: toolArgs.quantity * toolArgs.unit_price,
          currency: "EUR",
          status: "pending",
          notes: [
            toolArgs.notes,
            toolArgs.delivery_address ? `Livraison: ${toolArgs.delivery_address}` : null,
            `Client WhatsApp: ${customerPhone}`
          ].filter(Boolean).join(" | "),
          metadata: { source: "whatsapp", customer_phone: customerPhone }
        });
        return JSON.stringify({
          success: true,
          order_id: (order as unknown).id,
          order_number: (order as unknown).orderNumber,
          total: (order as unknown).totalAmount,
          status: "pending"
        });
      }

      case "request_payment": {
        const { createStripeCustomer, createPortalSession } = await import("./stripeService");
        const { ENV } = await import("../_core/env");
        let paymentUrl = `https://pay.servicall.com/checkout/${Date.now()}`;
        try {
          const customerId = await createStripeCustomer(
            `${customerPhone}@whatsapp.placeholder`,
            customerPhone,
            tenantId,
            { source: "whatsapp" }
          );
          paymentUrl = await createPortalSession(
            tenantId,
            customerId,
            ENV.appUrl || "https://app.servicall.com"
          );
        } catch (stripeErr: any) {
          logger.warn("[WhatsApp] Stripe unavailable, using fallback URL", { err: stripeErr.message });
        }
        return JSON.stringify({
          success: true,
          payment_url: paymentUrl,
          amount: toolArgs.amount,
          description: toolArgs.description
        });
      }

      case "get_order_status": {
        try {
          const { db: database } = await import("../db");
          const orders = await (database as unknown).query.orders?.findMany?.({
            where: (o: any, { and, eq, like }: any) => and(
              eq(o.tenantId, tenantId),
              like(o.notes, `%${customerPhone}%`)
            ),
            orderBy: (o: any, { desc }: any) => [desc(o.createdAt)],
            limit: 1,
          }) ?? [];
          if (!orders || orders.length === 0) {
            return JSON.stringify({ found: false, message: "Aucune commande trouvée pour ce numéro." });
          }
          const order = orders[0];
          return JSON.stringify({
            found: true,
            order_number: order.orderNumber,
            status: order.status,
            total: order.totalAmount,
            created_at: order.createdAt,
          });
        } catch (err: any) {
          return JSON.stringify({ found: false, message: "Impossible de récupérer le statut." });
        }
      }

      case "suggest_upsell": {
        const { businessKnowledgeService } = await import("./BusinessKnowledgeService");
        const suggestions = await businessKnowledgeService.searchEntities(
          tenantId,
          toolArgs.category || toolArgs.base_product,
          "product"
        );
        const filtered = suggestions
          .filter((s: any) => s.title !== toolArgs.base_product && s.isActive !== false)
          .slice(0, 3);
        return JSON.stringify({
          suggestions: filtered.map((s: any) => ({
            name: s.title,
            price: s.price,
            description: s.description
          }))
        });
      }

      default:
        return JSON.stringify({ error: `Tool "${toolName}" non reconnu.` });
    }
  } catch (err: any) {
    logger.error(`[WhatsApp] Tool execution failed: ${toolName}`, { err: err.message });
    return JSON.stringify({ error: `Erreur lors de l'exécution de ${toolName}: ${err.message}` });
  }
}

// ─────────────────────────────────────────────
// Dialogue principal IA
// ─────────────────────────────────────────────

/**
 * Traite un message WhatsApp entrant et génère une réponse IA via boucle agentic
 */
export async function handleIncomingWhatsAppMessage(
  message: WhatsAppMessage,
  tenantId: number,
  tenantName: string,
  tenantConfig: {
    wabaPhoneNumberId?: string;
    wabaAccessToken?: string;
    twilioSid?: string;
    twilioToken?: string;
    twilioPhone?: string;
  }
): Promise<WhatsAppDialogueResult> {
  try {
    const detectedLang = detectLanguage(message.body);
    logger.info("[WhatsApp] Incoming message", {
      from: message.from,
      lang: detectedLang,
      preview: message.body.slice(0, 60),
    });

    const memory = await getContactMemory(tenantId, message.from);
    const industryPrompt = await generateTenantSystemPrompt(tenantId, tenantName);

    const systemPrompt = `${industryPrompt}

Tu es le vendeur WhatsApp de ${tenantName}.
${getLanguageInstruction(detectedLang)}

CAPACITÉS DISPONIBLES (utilise-les activement) :
- check_stock : vérifier disponibilité et prix d'un produit
- create_order : créer une commande (TOUJOURS demander confirmation client avant)
- request_payment : générer un lien de paiement Stripe
- get_order_status : suivre une commande existante
- suggest_upsell : proposer des produits complémentaires

RÈGLES VENDEUR :
- Sois concis (2-4 phrases max sur WhatsApp)
- Réponds toujours en ${detectedLang}
- Appelle check_stock dès qu'un produit est mentionné
- Ne crée JAMAIS une commande sans confirmation explicite du client ("oui", "ok", "je confirme")
- Envoie le lien de paiement APRÈS create_order uniquement
- Propose toujours suggest_upsell après une vente réussie
${memory.memoryPrompt}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message.body }
    ];

    let finalReply = "";
    const MAX_ITERATIONS = 5;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await invokeLLM(tenantId, {
        model: AI_MODEL.DEFAULT,
        messages,
        tools: VENDOR_AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 500,
      });

      const choice = (response as unknown).choices[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) break;
      messages.push(assistantMessage);

      if (choice.finish_reason === "stop" || !assistantMessage.tool_calls?.length) {
        finalReply = assistantMessage.content?.trim() ?? "";
        break;
      }

      for (const toolCall of assistantMessage.tool_calls) {
        let toolArgs: Record<string, any> = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch {}

        const toolResult = await executeVendorTool(
          toolCall.function.name,
          toolArgs,
          tenantId,
          message.from
        );

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    if (!finalReply) {
      finalReply = "Je n'ai pas pu traiter votre demande. Pouvez-vous reformuler ?";
    }

    await sendWhatsAppReply(message.from, finalReply, tenantConfig);

    saveInteractionMemory({
      tenantId,
      contactIdentifier: message.from,
      contactName: message.profileName,
      channel: "whatsapp",
      manualSummary: `"${message.body.slice(0, 100)}" → "${finalReply.slice(0, 100)}"`,
      keyFacts: { language: detectedLang, sentiment: "neutral" },
    }).catch((err) => logger.warn("[WhatsApp] Memory save failed", { err }));

    return {
      replied: true,
      response: finalReply,
      language: detectedLang,
      memoryUsed: memory.hasMemory,
    };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[WhatsApp] Agent failed", { err: msg, from: message.from });
    return { replied: false, error: msg };
  }
}

/**
 * Parse un webhook Meta WhatsApp Business API
 */
export function parseMetaWebhookMessage(body: any): WhatsAppMessage | null {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];

    if (!msg || msg.type !== "text") return null;

    const contact = value?.contacts?.[0];

    return {
      from: msg.from,
      to: value.metadata?.display_phone_number ?? "",
      body: msg.text?.body ?? "",
      messageId: msg.id,
      timestamp: parseInt(msg.timestamp ?? "0"),
      type: "text",
      profileName: contact?.profile?.name,
    };
  } catch {
    return null;
  }
}

/**
 * Parse un webhook Twilio WhatsApp (form-encoded)
 */
export function parseTwilioWebhookMessage(body: Record<string, string>): WhatsAppMessage | null {
  if (!body.From || !body.Body) return null;
  return {
    from: body.From.replace("whatsapp:", ""),
    to: (body.To ?? "").replace("whatsapp:", ""),
    body: body.Body,
    messageId: body.MessageSid ?? `twilio_${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    type: "text",
    profileName: body.ProfileName,
  };
}
