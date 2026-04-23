/**
 * SOCIAL SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour la gestion des réseaux sociaux.
 * Centralise la logique métier, l'accès DB et l'orchestration IA.
 */

import { db, socialAccounts, socialPosts, tenants, businessEntities } from "../db";
import { eq, and, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";
import { getOpenAIClient } from "../_core/openaiClient";
import { generateImage } from "../_core/imageGeneration";
import { AI_MODEL } from "../_core/aiModels";
import { createFacebookService } from "./social/facebook-service";
import { createTikTokService } from "./social/tiktok-service";
import { createLinkedInService, createTwitterService } from "./social/linkedin-twitter-service";

export class SocialService {
  /**
   * Récupère le statut des connexions pour un tenant
   */
  static async getConnectionsStatus(tenantId: number) {
    const accounts = await db.select().from(socialAccounts)
      .where(eq(socialAccounts.tenantId, tenantId));
    
    const status: Record<string, string> = {
      facebook: "disconnected",
      instagram: "disconnected",
      linkedin: "disconnected",
      twitter: "disconnected",
      tiktok: "disconnected"
    };
    
    accounts.forEach((acc) => {
      status[acc.platform] = acc.isActive ? "connected" : "error";
    });
    
    const fbService = createFacebookService();
    const tiktokService = createTikTokService();
    const liService = createLinkedInService();
    const twService = createTwitterService();
    
    if (fbService.isConfigured()) {
      if (status.facebook === "disconnected") status.facebook = "configured";
      if (status.instagram === "disconnected") status.instagram = "configured";
    }
    if (tiktokService.isConfigured() && status.tiktok === "disconnected") status.tiktok = "configured";
    if (liService.isConfigured() && status.linkedin === "disconnected") status.linkedin = "configured";
    if (twService.isConfigured() && status.twitter === "disconnected") status.twitter = "configured";
    
    return status;
  }

  /**
   * Connecte ou met à jour un compte social
   */
  static async connectAccount(tenantId: number, data: {
    platform: string;
    accessToken: string;
    accountName?: string;
    platformAccountId?: string;
    metadata?: Record<string, any>;
  }) {
    const existing = await db.select().from(socialAccounts)
      .where(and(
        eq(socialAccounts.tenantId, tenantId),
        eq(socialAccounts.platform, data.platform as unknown)
      ))
      .limit(1);
    
    if (existing[0]) {
      await db.update(socialAccounts)
        .set({
          accessToken: data.accessToken,
          accountName: data.accountName,
          isActive: true,
          updatedAt: new Date(),
          metadata: data.metadata || {}
        })
        .where(eq(socialAccounts.id, existing[0].id));
    } else {
      await db.insert(socialAccounts).values({
        tenantId: tenantId,
        platform: data.platform as unknown,
        platformAccountId: data.platformAccountId || `manual_${Date.now()}`,
        accountName: data.accountName || data.platform,
        accessToken: data.accessToken,
        isActive: true,
        metadata: data.metadata || {}
      });
    }
    return { success: true, platform: data.platform };
  }

  /**
   * Déconnecte un compte social
   */
  static async disconnectAccount(tenantId: number, platform: string) {
    await db.update(socialAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(socialAccounts.tenantId, tenantId),
        eq(socialAccounts.platform, platform as unknown)
      ));
    return { success: true };
  }

  /**
   * Liste les posts avec pagination et filtres
   */
  static async listPosts(tenantId: number, params: {
    page: number;
    limit: number;
    status?: string;
    platform?: string;
  }) {
    const { page, limit, status, platform } = params;
    const offset = (page - 1) * limit;
    
    const conditions = [eq(socialPosts.tenantId, tenantId)];
    if (status) conditions.push(eq(socialPosts.status, status as unknown));
    if (platform) conditions.push(eq(socialPosts.platform, platform as unknown));
    
    const [data, totalResult] = await Promise.all([
      db.select().from(socialPosts)
        .where(and(...conditions))
        .limit(limit)
        .offset(offset)
        .orderBy(desc(socialPosts.scheduledAt), desc(socialPosts.createdAt)),
      db.select({ value: count() })
        .from(socialPosts)
        .where(and(...conditions))
    ]);
    
    return { data, total: totalResult[0]?.value ?? 0 };
  }

  /**
   * Génère des posts via IA
   */
  static async generatePosts(tenantId: number, params: {
    prompt: string;
    count: number;
    platforms: string[];
  }) {
    const [tenant, businessInfo] = await Promise.all([
      db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
      db.select().from(businessEntities).where(eq(businessEntities.tenantId, tenantId)).limit(5)
    ]);
    
    const tenantData = tenant[0];
    if (!tenantData) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant non trouvé" });

    const contextData = {
      business_name: tenantData.name ?? "Servicall",
      city: "Paris",
      phone_number: "+33 1 23 45 67 89",
      product: (businessInfo as unknown[]).find((e: any) => e.type === "product")?.title || "nos services",
      service: (businessInfo as unknown[]).find((e: any) => e.type === "service")?.title || "support client",
    };

    const systemPrompt = `Tu es l'IA Social Media Manager de Servicall v2.
Génère des posts optimisés pour chaque réseau social selon les spécificités de chaque plateforme:
- Facebook: posts engageants avec call-to-action, 1-3 paragraphes
- Instagram: visuels, émojis, hashtags populaires, ton inspirant
- LinkedIn: professionnel, insights business, thought leadership
- Twitter/X: concis (<280 chars), percutant, hashtags tendance
- TikTok: ton jeune et dynamique, trends, hooks accrocheurs, idées de vidéos courtes

Contexte business: ${JSON.stringify(contextData)}
Plateformes demandées: ${params.platforms.join(", ")}

Réponds en JSON avec cette structure:
{
  "posts": [
    {
      "platform": "facebook|instagram|linkedin|twitter|tiktok",
      "content": "...",
      "hashtags": ["tag1", "tag2"],
      "tiktokVideoIdea": "...",
      "engagementScore": 8,
      "imagePrompt": "Professional photo of ... , high quality, no text"
    }
  ]
}`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const generatedPosts = result.posts || [];

    const createdPosts = [];
    for (const post of generatedPosts) {
      if (!params.platforms.includes(post.platform)) continue;

      let imageUrl: string | null = null;
      if (post.imagePrompt && post.platform !== "tiktok") {
        try {
          const imageResult = await generateImage({ prompt: post.imagePrompt });
          imageUrl = imageResult.url ?? null;
        } catch (imgErr: any) {
          logger.warn("[SocialService] Image generation failed", { error: imgErr.message, platform: post.platform });
        }
      }

      const [newPost] = await db.insert(socialPosts).values({
        tenantId: tenantId,
        platform: post.platform,
        content: post.content,
        mediaUrls: imageUrl ? [imageUrl] : [],
        status: "draft",
        metadata: {
          hashtags: post.hashtags,
          tiktokVideoIdea: post.tiktokVideoIdea,
          engagementScore: post.engagementScore,
          aiGenerated: true
        }
      }).returning();

      createdPosts.push(newPost);
    }

    return createdPosts;
  }
}
