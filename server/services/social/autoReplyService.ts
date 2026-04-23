/**
 * AUTO-REPLY SERVICE — Messenger · Instagram · TikTok
 * ─────────────────────────────────────────────────────────────
 * Répond automatiquement aux messages et commentaires sur :
 *   - Facebook Messenger (messages privés)
 *   - Instagram DM + commentaires publics
 *   - TikTok commentaires
 *
 * FLUX :
 *  1. Meta / TikTok envoie un webhook
 *  2. Ce service détecte le type (message privé, commentaire)
 *  3. Génère une réponse IA contextualisée au métier du tenant
 *  4. Répond via l'API correspondante
 *  5. Sauvegarde en mémoire pour cohérence future
 */

import { invokeLLM } from "../../_core/llm";
import { AI_MODEL } from "../../_core/aiModels";
import { logger } from "../../infrastructure/logger";
import { getContactMemory, saveInteractionMemory } from "../aiMemoryService";
import { buildSystemPrompt } from "./aiPromptEngine";
import { decryptToken } from "../../routers/socialRouter";
import { createLinkedInService, createTwitterService } from "./linkedin-twitter-service";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type AutoReplyPlatform = "messenger" | "instagram_dm" | "instagram_comment" | "tiktok_comment" | "linkedin_comment" | "twitter_mention";

export interface IncomingPlatformMessage {
  platform: AutoReplyPlatform;
  senderId: string;           // ID utilisateur ou commentateur
  senderName?: string;
  recipientId: string;        // ID de la Page / compte
  messageId: string;
  text: string;
  timestamp: number;
  postId?: string;            // Pour les commentaires
  commentId?: string;
}

export interface AutoReplyResult {
  replied: boolean;
  response?: string;
  platform: AutoReplyPlatform;
  error?: string;
  simulated?: boolean;
}

// ─────────────────────────────────────────────
// Helpers : envoyer des réponses via Meta Graph API
// ─────────────────────────────────────────────

async function sendMessengerReply(
  recipientId: string,
  message: string,
  pageAccessToken: string
): Promise<boolean> {
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/me/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pageAccessToken}` },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: "RESPONSE",
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.warn("[AutoReply] Messenger send failed", { err, status: res.status });
      return false;
    }
    logger.info("[AutoReply] Messenger reply sent", { recipientId });
    return true;
  } catch (err: any) {
    logger.error("[AutoReply] Messenger send exception", { err });
    return false;
  }
}

async function sendInstagramDMReply(
  recipientId: string,
  message: string,
  pageAccessToken: string
): Promise<boolean> {
  try {
    const res = await fetch("https://graph.facebook.com/v18.0/me/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pageAccessToken}` },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });
    const ok = res.ok;
    if (!ok) logger.warn("[AutoReply] Instagram DM failed", { status: res.status });
    return ok;
  } catch (err: any) {
    logger.error("[AutoReply] Instagram DM exception", { err });
    return false;
  }
}

async function replyToInstagramComment(
  commentId: string,
  message: string,
  pageAccessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pageAccessToken}` },
      body: JSON.stringify({ message }),
    });
    const ok = res.ok;
    if (!ok) logger.warn("[AutoReply] Instagram comment reply failed", { status: res.status, commentId });
    return ok;
  } catch (err: any) {
    logger.error("[AutoReply] Instagram comment reply exception", { err });
    return false;
  }
}

async function replyToTikTokComment(
  videoId: string,
  commentId: string,
  message: string,
  accessToken: string
): Promise<boolean> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/comment/reply/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        video_id: videoId,
        parent_comment_id: commentId,
        text: message.slice(0, 150), // TikTok max 150 chars
      }),
    });
    const ok = res.ok;
    if (!ok) logger.warn("[AutoReply] TikTok comment reply failed", { status: res.status });
    return ok;
  } catch (err: any) {
    logger.error("[AutoReply] TikTok reply exception", { err });
    return false;
  }
}

// ─────────────────────────────────────────────
// Récupérer les credentials du tenant depuis la DB
// ─────────────────────────────────────────────

async function getTenantSocialToken(tenantId: number, platform: "facebook" | "instagram" | "tiktok"): Promise<string | null> {
  try {
    const { db } = await import("../../db");
    const { socialAccounts } = await import("../../../drizzle/schema-social");
    const { eq, and } = await import("drizzle-orm");

    const dbPlatform = platform === "instagram" ? "instagram" : platform;
    const [account] = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.tenantId, tenantId), eq(socialAccounts.platform, dbPlatform), eq(socialAccounts.isActive, true)))
      .limit(1);

    if (account?.accessToken) {
      return decryptToken(account.accessToken);
    }

    // Fallback ENV
    if (platform === "facebook" || platform === "instagram") {
      return process.env["FACEBOOK_ACCESS_TOKEN"] ?? null;
    }
    if (platform === "tiktok") {
      return process.env["TIKTOK_ACCESS_TOKEN"] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Génération de la réponse IA
// ─────────────────────────────────────────────

async function generateAutoReply(
  message: IncomingPlatformMessage,
  tenantId: number,
  tenantName: string
): Promise<string> {
  const memory = await getContactMemory(tenantId, message.senderId);

  // ✅ Utilise le Prompt Engine complet (marque, produits, tarifs, FAQ, règles canal)
  const systemPrompt = await buildSystemPrompt(
    tenantId,
    tenantName,
    
    message.platform,
    memory.hasMemory ? memory.memoryPrompt : undefined
  );

  const response = await invokeLLM(tenantId, {
    model: AI_MODEL.DEFAULT,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message.text },
    ],
    temperature: 0.7,
    max_tokens: message.platform.includes("comment") ? 150 : 300,
  });

  return (response.choices[0]?.message?.content as string)?.trim()
    ?? "Merci pour votre message ! Nous vous répondons rapidement.";
}

// ─────────────────────────────────────────────
// Point d'entrée principal
// ─────────────────────────────────────────────

export async function handleAutoReply(
  message: IncomingPlatformMessage,
  tenantId: number,
  tenantName: string
): Promise<AutoReplyResult> {
  try {
    // Générer la réponse IA
    const aiReply = await generateAutoReply(message, tenantId, tenantName);

    let replied = false;
    let simulated = false;

    switch (message.platform) {
      case "messenger": {
        const token = await getTenantSocialToken(tenantId, "facebook");
        if (token) {
          replied = await sendMessengerReply(message.senderId, aiReply, token);
        } else {
          logger.warn("[AutoReply] No Facebook token — simulating Messenger reply", { tenantId });
          simulated = true;
          replied = true;
        }
        break;
      }

      case "instagram_dm": {
        const token = await getTenantSocialToken(tenantId, "instagram");
        if (token) {
          replied = await sendInstagramDMReply(message.senderId, aiReply, token);
        } else {
          logger.warn("[AutoReply] No Instagram token — simulating DM reply", { tenantId });
          simulated = true;
          replied = true;
        }
        break;
      }

      case "instagram_comment": {
        const token = await getTenantSocialToken(tenantId, "instagram");
        if (token && message.commentId) {
          replied = await replyToInstagramComment(message.commentId, aiReply, token);
        } else {
          logger.warn("[AutoReply] No Instagram token or commentId — simulating", { tenantId });
          simulated = true;
          replied = true;
        }
        break;
      }

      case "tiktok_comment": {
        const token = await getTenantSocialToken(tenantId, "tiktok");
        if (token && message.postId && message.commentId) {
          replied = await replyToTikTokComment(message.postId, message.commentId, aiReply, token);
        } else {
          logger.warn("[AutoReply] No TikTok token — simulating comment reply", { tenantId });
          simulated = true;
          replied = true;
        }
        break;
      }

      // ✅ CORRECTION: LinkedIn commentaires (câblé)
      case "linkedin_comment": {
        const linkedInService = createLinkedInService();
        if (message.commentId) {
          const result = await linkedInService.replyToComment(message.commentId, aiReply);
          replied = result.success;
          simulated = result.simulated ?? false;
          if (!result.success) {
            logger.warn("[AutoReply] LinkedIn comment reply failed", { tenantId, error: result.error });
          }
        } else {
          logger.warn("[AutoReply] No commentId for LinkedIn reply — simulating", { tenantId });
          simulated = true;
          replied = true;
        }
        break;
      }

      // ✅ CORRECTION: Twitter/X mentions (câblé)
      case "twitter_mention": {
        const twitterService = createTwitterService();
        if (message.messageId) {
          const result = await twitterService.replyToMention(message.messageId, aiReply);
          replied = result.success;
          simulated = result.simulated ?? false;
          if (!result.success) {
            logger.warn("[AutoReply] Twitter mention reply failed", { tenantId, error: result.error });
          }
        } else {
          logger.warn("[AutoReply] No messageId for Twitter reply — simulating", { tenantId });
          simulated = true;
          replied = true;
        }
        break;
      }
    }

    // Sauvegarder en mémoire (non-bloquant)
    saveInteractionMemory({
      tenantId,
      contactIdentifier: message.senderId,
      contactName: message.senderName,
      
      channel: message.platform, // ✅ CORRECTION: canal réel au lieu de "whatsapp" hardcodé
      manualSummary: `[${message.platform}] "${message.text.slice(0, 80)}" → "${aiReply.slice(0, 80)}"`,
      keyFacts: { platform: message.platform, autoReplied: true } as Record<string, unknown>,
    }).catch((err) => logger.warn("[AutoReply] Memory save failed", { err }));

    logger.info("[AutoReply] Completed", { platform: message.platform, replied, simulated, tenantId });

    return { replied, response: aiReply, platform: message.platform, simulated };
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error("[AutoReply] Failed", { err: errMsg, platform: message.platform, tenantId });
    return { replied: false, platform: message.platform, error: errMsg };
  }
}

// ─────────────────────────────────────────────
// Parsers webhook Meta (Messenger + Instagram)
// ─────────────────────────────────────────────

export function parseMetaMessengerWebhook(body: Record<string, unknown>): IncomingPlatformMessage | null {
  try {
    const entry = (body["entry"] as Record<string, unknown>[])?.[0];
    const messaging = (entry?.["messaging"] as Record<string, unknown>[])?.[0];
    if (!messaging?.["message"]) return null;
    const msg = messaging["message"] as Record<string, unknown>;
    if (msg["is_echo"]) return null; // ignorer les messages envoyés par la page elle-même

    return {
      platform: "messenger",
      senderId: (messaging["sender"] as Record<string, unknown>)?.["id"] as string,
      recipientId: (messaging["recipient"] as Record<string, unknown>)?.["id"] as string,
      messageId: msg["mid"] as string ?? `msg_${Date.now()}`,
      text: (msg["text"] as string) ?? "",
      timestamp: messaging["timestamp"] as number ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function parseInstagramWebhook(body: Record<string, unknown>): IncomingPlatformMessage | null {
  try {
    const entry = (body["entry"] as Record<string, unknown>[])?.[0];
    const changes = (entry?.["changes"] as Record<string, unknown>[])?.[0];
    const value = changes?.["value"] as Record<string, unknown>;

    // DM Instagram
    if (changes?.["field"] === "messages") {
      const messages = (entry?.["messaging"] as Record<string, unknown>[])?.[0];
      if (!messages) return null;
      const msg = messages["message"] as Record<string, unknown>;
      return {
        platform: "instagram_dm",
        senderId: (messages["sender"] as Record<string, unknown>)?.["id"] as string,
        recipientId: (messages["recipient"] as Record<string, unknown>)?.["id"] as string,
        messageId: msg?.["mid"] as string ?? `ig_${Date.now()}`,
        text: (msg?.["text"] as string) ?? "",
        timestamp: Date.now(),
      };
    }

    // Commentaire Instagram
    if (changes?.["field"] === "comments") {
      return {
        platform: "instagram_comment",
        senderId: value?.["from"]?.["id"] as string ?? "unknown",
        senderName: value?.["from"]?.["name"] as string,
        recipientId: entry?.["id"] as string ?? "",
        messageId: value?.["id"] as string ?? `igc_${Date.now()}`,
        commentId: value?.["id"] as string,
        postId: value?.["media"]?.["id"] as string,
        text: (value?.["text"] as string) ?? "",
        timestamp: Date.now(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function parseTikTokCommentWebhook(body: Record<string, unknown>): IncomingPlatformMessage | null {
  try {
    // TikTok Business API webhook structure
    const event = body["event"] as string;
    if (event !== "comment.create") return null;

    const data = body["data"] as Record<string, unknown>;
    return {
      platform: "tiktok_comment",
      senderId: data?.["user_id"] as string ?? "unknown",
      senderName: data?.["display_name"] as string,
      recipientId: data?.["video_owner_id"] as string ?? "",
      messageId: data?.["comment_id"] as string ?? `tiktok_${Date.now()}`,
      commentId: data?.["comment_id"] as string,
      postId: data?.["video_id"] as string,
      text: (data?.["text"] as string) ?? "",
      timestamp: (data?.["create_time"] as number) ?? Math.floor(Date.now() / 1000),
    };
  } catch {
    return null;
  }
}