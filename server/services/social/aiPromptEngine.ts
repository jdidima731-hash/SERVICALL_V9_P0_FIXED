/**
 * AI PROMPT ENGINE — Moteur de Personnalité de Marque
 * ─────────────────────────────────────────────────────────────
 * Construit le prompt système complet pour l'assistant IA en intégrant :
 *
 *  1. IDENTITÉ  — Nom de la marque, secteur, ton, langue
 *  2. RÔLE      — Ce que l'IA doit faire et ne pas faire
 *  3. PRODUITS  — Catalogue depuis businessEntities (DB)
 *  4. TARIFS    — Prix depuis businessEntities
 *  5. FAQ       — Questions/réponses configurées
 *  6. WEB       — Contenu extrait de l'URL de la page (scraping)
 *  7. CANAL     — Règles spécifiques à la plateforme (WhatsApp, Messenger, etc.)
 *  8. CONTACT   — Numéro de téléphone, email, horaires
 *  9. MÉMOIRE   — Historique du contact injecté
 *
 * Le client configure tout via l'UI BrandConfigPanel.
 * Les prompts sont mis en cache 1h pour éviter des requêtes DB répétées.
 */

import { logger } from "../../infrastructure/logger";
import { invokeLLM } from "../../_core/llm";
import { AI_MODEL } from "../../_core/aiModels";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ReplyChannel =
  | "whatsapp"
  | "messenger"
  | "instagram_dm"
  | "instagram_comment"
  | "tiktok_comment";

export interface BrandAIConfig {
  // Identité
  brandName: string;
  tagline?: string;
  sector?: string;
  language: string;           // "fr" | "ar" | "en" | "auto"
  tone: "formal" | "friendly" | "dynamic" | "luxury";

  // Rôle IA
  aiRole: string;             // "assistante commerciale" | "support client" | ...
  aiMission: string;          // Description libre du rôle
  allowedTopics: string[];    // ["tarifs","produits","rdv","livraison"]
  forbiddenTopics: string[];  // ["concurrents","politique"]

  // Contact & Escalade
  phoneNumber?: string;
  email?: string;
  address?: string;
  businessHours?: string;     // "Lun-Ven 9h-18h"
  escalationMessage?: string; // Message quand l'IA ne sait pas

  // Produits & Tarifs (depuis businessEntities DB)
  includePricing: boolean;
  includeProducts: boolean;
  customPricingText?: string; // Texte libre complémentaire

  // Contenu web (optionnel)
  websiteUrl?: string;
  scrapedContent?: string;    // Contenu pré-extrait (mis à jour manuellement)
  faqItems?: Array<{ question: string; answer: string }>;

  // Instructions spéciales
  customInstructions?: string;
}

export interface ProductInfo {
  title: string;
  description?: string;
  price?: string;
  type: string;
}

// ─────────────────────────────────────────────
// Cache mémoire (1h)
// ─────────────────────────────────────────────

const promptCache = new Map<number, { prompt: string; builtAt: number; channel?: ReplyChannel }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

function getCached(tenantId: number, channel: ReplyChannel): string | null {
  const entry = promptCache.get(tenantId);
  if (!entry) return null;
  if (Date.now() - entry.builtAt > CACHE_TTL_MS) { promptCache.delete(tenantId); return null; }
  if (entry.channel !== channel) return null;
  return entry.prompt;
}

function setCache(tenantId: number, channel: ReplyChannel, prompt: string): void {
  promptCache.set(tenantId, { prompt, builtAt: Date.now(), channel });
}

export function clearPromptCache(tenantId: number): void {
  promptCache.delete(tenantId);
  logger.info("[AIPromptEngine] Cache cleared", { tenantId });
}

// ─────────────────────────────────────────────
// Récupérer la config de marque depuis la DB
// ─────────────────────────────────────────────

export async function getBrandAIConfig(tenantId: number): Promise<BrandAIConfig | null> {
  try {
    const { db } = await import("../../db");
    const { tenants } = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) return null;

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const brandConfig = (settings["brandAIConfig"] ?? {}) as Partial<BrandAIConfig>;

    return {
      brandName: tenant.name ?? "Mon Entreprise",
      tagline: brandConfig.tagline,
      sector: tenant.businessType ?? brandConfig.sector,
      language: ((tenant as unknown).whatsappAiLanguage ?? brandConfig.language ?? "auto") as BrandAIConfig["language"],
      tone: ((tenant as unknown).whatsappAiTone as BrandAIConfig["tone"]) ?? brandConfig.tone ?? "friendly",
      aiRole: brandConfig.aiRole ?? "assistante virtuelle",
      aiMission: brandConfig.aiMission ?? (tenant as unknown).whatsappAiPersona ?? tenant.aiCustomScript ?? "",
      allowedTopics: brandConfig.allowedTopics ?? ["produits", "tarifs", "rendez-vous", "informations générales"],
      forbiddenTopics: brandConfig.forbiddenTopics ?? ["prix des concurrents", "données personnelles d'autres clients"],
      phoneNumber: brandConfig.phoneNumber,
      email: (tenant as unknown).email ?? brandConfig.email,
      address: brandConfig.address,
      businessHours: brandConfig.businessHours,
      escalationMessage: brandConfig.escalationMessage ?? "Je vais transmettre votre demande à notre équipe qui vous contactera rapidement.",
      includePricing: brandConfig.includePricing !== false,
      includeProducts: brandConfig.includeProducts !== false,
      customPricingText: brandConfig.customPricingText,
      websiteUrl: brandConfig.websiteUrl,
      scrapedContent: brandConfig.scrapedContent,
      faqItems: brandConfig.faqItems ?? [],
      customInstructions: brandConfig.customInstructions,
    };
  } catch (err: any) {
    logger.error("[AIPromptEngine] getBrandAIConfig failed", { err, tenantId });
    return null;
  }
}

// ─────────────────────────────────────────────
// Récupérer les produits et tarifs depuis la DB
// ─────────────────────────────────────────────

async function getProductsAndPricing(tenantId: number): Promise<ProductInfo[]> {
  try {
    const { db } = await import("../../db");
    const { businessEntities } = await import("../../../drizzle/schema-business");
    const { eq, and } = await import("drizzle-orm");

    const entities = await db
      .select()
      .from(businessEntities)
      .where(and(eq(businessEntities.tenantId, tenantId), eq(businessEntities.isActive, true)))
      .limit(30);

    return entities.map((e: any) => ({
      title: e.title,
      description: e.description ?? undefined,
      price: e.price ? `${parseFloat(String(e.price)).toFixed(2)} €` : undefined,
      type: e.type,
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Scraper le contenu d'une URL (leger, timeout 5s)
// ─────────────────────────────────────────────

async function scrapeWebsiteContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Servicall-AIBot/1.0 (assistant; contact@servicall.com)" },
    });
    clearTimeout(timeout);

    const html = await res.text();

    // Extraction du texte brut — supprimer les balises HTML
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 3000); // max 3000 chars pour ne pas saturer le prompt

    logger.info("[AIPromptEngine] Website scraped", { url, length: text.length });
    return text;
  } catch (err: any) {
    logger.warn("[AIPromptEngine] Website scraping failed", { url, err });
    return "";
  }
}

// ─────────────────────────────────────────────
// Règles spécifiques par canal
// ─────────────────────────────────────────────

function getChannelRules(channel: ReplyChannel): string {
  const rules: Record<ReplyChannel, string> = {
    whatsapp: `RÈGLES WHATSAPP :
- Maximum 3-4 phrases par réponse (les messages longs sont ignorés sur mobile)
- Utiliser des sauts de ligne pour aérer
- Proposer de continuer par téléphone pour les sujets complexes
- Éviter les liens sauf si explicitement demandés
- Tu peux utiliser quelques emojis pour rendre le message chaleureux 😊`,

    messenger: `RÈGLES MESSENGER :
- Réponses de 2-4 phrases, ton conversationnel et chaleureux
- Tu peux inclure un lien vers le site si pertinent
- Proposer de poursuivre avec un agent humain si la demande est complexe
- Éviter les messages trop longs`,

    instagram_dm: `RÈGLES INSTAGRAM DM :
- Ton décontracté mais professionnel, 2-3 phrases
- Utiliser des emojis avec modération
- Rediriger vers le site ou le téléphone pour les devis
- Répondre rapidement et de manière engageante`,

    instagram_comment: `RÈGLES COMMENTAIRE INSTAGRAM :
- TRÈS court : 1 phrase maximum (les commentaires trop longs semblent du spam)
- Positif, encourageant, pro-marque
- Si question commerciale → inviter à envoyer un DM : "Envoie-nous un message privé 📩"
- Jamais de prix publiquement dans les commentaires`,

    tiktok_comment: `RÈGLES COMMENTAIRE TIKTOK :
- Ultra-court : 1 phrase, maximum 150 caractères
- Ton dynamique, émojis acceptés
- Si question → rediriger vers le lien en bio ou les DMs
- Jamais de prix ni de données sensibles en commentaire public`,
  };
  return rules[channel];
}

// ─────────────────────────────────────────────
// Constructeur de prompt principal
// ─────────────────────────────────────────────

export async function buildSystemPrompt(
  tenantId: number,
  tenantName: string,
  channel: ReplyChannel,
  memoryPrompt?: string
): Promise<string> {
  // Vérifier le cache
  const cached = getCached(tenantId, channel);
  if (cached) {
    // Injecter la mémoire fraîche même si le prompt de base est caché
    return memoryPrompt ? `${cached}\n\n${memoryPrompt}` : cached;
  }

  const config = await getBrandAIConfig(tenantId);
  const sections: string[] = [];

  // ── 1. IDENTITÉ & RÔLE ─────────────────────────────────────────────────
  const brandName = config?.brandName ?? tenantName;
  const tone = config?.tone ?? "friendly";
  const toneMap: Record<string, string> = {
    formal: "professionnel et formel",
    friendly: "chaleureux et accessible",
    dynamic: "dynamique et enthousiaste",
    luxury: "élégant et haut de gamme",
  };

  sections.push(`# IDENTITÉ
Tu es ${config?.aiRole ?? "l'assistante virtuelle"} de **${brandName}**.
${config?.tagline ? `Slogan : "${config.tagline}"` : ""}
${config?.sector ? `Secteur : ${config.sector}` : ""}
Ton : ${toneMap[tone] ?? "chaleureux et accessible"}
${config?.aiMission ? `\nTA MISSION : ${config.aiMission}` : ""}`);

  // ── 2. INSTRUCTIONS GÉNÉRALES ──────────────────────────────────────────
  sections.push(`# COMPORTEMENT
- Tu représentes **${brandName}** avec professionnalisme
- Tu réponds UNIQUEMENT sur les sujets liés à nos activités
- Tu ne mentionnes jamais nos concurrents
- Si tu ne sais pas, tu utilises ce message : "${config?.escalationMessage ?? "Je transmets votre demande à notre équipe."}"
- Tu ne divulgues jamais les données d'autres clients
- Tu ne fais jamais de promesses contractuelles (prix définitifs, délais garantis) sans validation humaine
${config?.forbiddenTopics?.length ? `- Sujets à éviter absolument : ${config.forbiddenTopics.join(", ")}` : ""}`);

  // ── 3. PRODUITS & TARIFS ───────────────────────────────────────────────
  if (config?.includeProducts || config?.includePricing) {
    const products = await getProductsAndPricing(tenantId);

    if (products.length > 0) {
      const productLines = products
        .filter((p: any) => config?.includeProducts || p.price)
        .map((p: any) => {
          let line = `• ${p.title}`;
          if (p.description) line += ` — ${p.description}`;
          if (config?.includePricing && p.price) line += ` → ${p.price}`;
          return line;
        })
        .join("\n");

      if (productLines) {
        sections.push(`# NOS PRODUITS & SERVICES\n${productLines}`);
      }
    }

    if (config?.customPricingText) {
      sections.push(`# INFORMATIONS TARIFAIRES COMPLÉMENTAIRES\n${config.customPricingText}`);
    }
  }

  // ── 4. CONTENU WEB (scraping ou pré-chargé) ────────────────────────────
  if (config?.websiteUrl || config?.scrapedContent) {
    let webContent = config.scrapedContent ?? "";

    // Scraper si URL fournie et pas de contenu pré-chargé
    if (config.websiteUrl && !webContent) {
      webContent = await scrapeWebsiteContent(config.websiteUrl);
    }

    if (webContent) {
      sections.push(`# INFORMATIONS DEPUIS NOTRE SITE WEB
${config.websiteUrl ? `Source : ${config.websiteUrl}` : ""}
${webContent}`);
    }
  }

  // ── 5. FAQ ─────────────────────────────────────────────────────────────
  if (config?.faqItems && config.faqItems.length > 0) {
    const faqLines = config.faqItems
      .map((item: any) => `Q: ${item.question}\nR: ${item.answer}`)
      .join("\n\n");
    sections.push(`# QUESTIONS FRÉQUENTES\n${faqLines}`);
  }

  // ── 6. CONTACT & HORAIRES ─────────────────────────────────────────────
  const contactLines: string[] = [];
  if (config?.phoneNumber) contactLines.push(`📞 Téléphone : ${config.phoneNumber}`);
  if (config?.email) contactLines.push(`📧 Email : ${config.email}`);
  if (config?.address) contactLines.push(`📍 Adresse : ${config.address}`);
  if (config?.businessHours) contactLines.push(`🕐 Horaires : ${config.businessHours}`);
  if (config?.websiteUrl) contactLines.push(`🌐 Site web : ${config.websiteUrl}`);

  if (contactLines.length > 0) {
    sections.push(`# NOS COORDONNÉES\n${contactLines.join("\n")}

Si le client demande à être rappelé ou contacté, communique ces informations.`);
  }

  // ── 7. INSTRUCTIONS PERSONNALISÉES ─────────────────────────────────────
  if (config?.customInstructions) {
    sections.push(`# INSTRUCTIONS SPÉCIALES\n${config.customInstructions}`);
  }

  // ── 8. RÈGLES DU CANAL ─────────────────────────────────────────────────
  sections.push(getChannelRules(channel));

  // ── 9. LANGUE ─────────────────────────────────────────────────────────
  const lang = config?.language ?? "auto";
  if (lang === "auto") {
    sections.push(`# LANGUE
Détecte automatiquement la langue du client et réponds dans la MÊME langue.
Langues supportées : français, arabe, darija (marocain), tunisien, algérien, anglais, espagnol.
Par défaut utilise le français si la langue est ambiguë.`);
  } else {
    const langNames: Record<string, string> = { fr: "français", ar: "arabe standard", dar: "darija marocain", tun: "tunisien", alg: "algérien", en: "anglais" };
    sections.push(`# LANGUE\nRéponds TOUJOURS en ${langNames[lang] ?? lang}.`);
  }

  // Assembler le prompt final (sans la mémoire — cachée séparément)
  const basePrompt = sections.join("\n\n─────────────────────────────────────\n\n");
  setCache(tenantId, channel, basePrompt);

  // Ajouter la mémoire du contact (non cachée car spécifique à chaque contact)
  const fullPrompt = memoryPrompt
    ? `${basePrompt}\n\n─────────────────────────────────────\n\n# HISTORIQUE CONTACT\n${memoryPrompt}`
    : basePrompt;

  return fullPrompt;
}

// ─────────────────────────────────────────────
// Scraper une URL à la demande (pour l'UI de config)
// ─────────────────────────────────────────────

export async function scrapeAndSummarize(url: string, tenantId: number): Promise<string> {
  const rawContent = await scrapeWebsiteContent(url);
  if (!rawContent) return "";

  try {
    const response = await invokeLLM(tenantId, {
      model: AI_MODEL.DEFAULT,
      messages: [
        {
          role: "system",
          content: "Tu es un expert en extraction d'informations commerciales. Résume le contenu d'un site web en bullet points clairs : produits/services proposés, tarifs mentionnés, valeurs de la marque, informations de contact. Maximum 500 mots.",
        },
        { role: "user", content: `Contenu brut du site à analyser :\n\n${rawContent}` },
      ],
      temperature: 0.3,
      max_tokens: 700,
    });

    return (response.choices[0]?.message?.content as string)?.trim() ?? rawContent;
  } catch {
    return rawContent;
  }
}

// ─────────────────────────────────────────────
// Générer un preview du prompt (pour l'UI)
// ─────────────────────────────────────────────

export async function generatePromptPreview(
  tenantId: number,
  tenantName: string,
  channel: ReplyChannel = "whatsapp",
  testMessage = "Bonjour, quels sont vos tarifs ?"
): Promise<{ prompt: string; sampleReply: string }> {
  const prompt = await buildSystemPrompt(tenantId, tenantName, channel);

  try {
    const response = await invokeLLM(tenantId, {
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: testMessage },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const sampleReply = (response.choices[0]?.message?.content as string)?.trim() ?? "";
    return { prompt, sampleReply };
  } catch {
    return { prompt, sampleReply: "(Aperçu indisponible — vérifiez votre clé OpenAI)" };
  }
}
