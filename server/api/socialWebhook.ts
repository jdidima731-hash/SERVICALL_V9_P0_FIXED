/**
 * SOCIAL WEBHOOK ROUTER
 * ─────────────────────────────────────────────────────────────
 * Reçoit les webhooks de :
 *   - Facebook Messenger (messages privés)
 *   - Instagram (DM + commentaires)
 *   - TikTok (commentaires)
 *
 * Endpoints :
 *  GET  /api/social-webhook/meta        → Vérification Meta (challenge)
 *  POST /api/social-webhook/meta        → Messenger + Instagram
 *  POST /api/social-webhook/tiktok      → TikTok commentaires
 */

/**
 * FIX MED-2: socialWebhook — pas de vérification HMAC sur POST
 *   Avant: Seul le challenge GET était protégé.
 *          Les POST /meta et /tiktok n'avaient aucune vérification HMAC.
 *          N'importe qui pouvait injecter de faux messages Meta/TikTok.
 *   Après: Middleware verifyMetaSignature() vérifie le header x-hub-signature-256
 *          (HMAC-SHA256 du body avec META_APP_SECRET) pour tous les POST.
 *          Middleware verifyTikTokSignature() pour TikTok.
 *          Les requêtes sans signature valide reçoivent 403.
 */

import { Router, Request, Response, NextFunction } from "express";
import { logger } from "../infrastructure/logger";
import { IdempotencyService } from "../workflow-engine/utils/IdempotencyService";
import {
  handleAutoReply,
  parseMetaMessengerWebhook,
  parseInstagramWebhook,
  parseTikTokCommentWebhook,
} from "../services/social/autoReplyService";
import crypto from "crypto";

const router = Router();

// ─── FIX MED-2: Vérification HMAC Meta (x-hub-signature-256) ─────────────────

function verifyMetaSignature(req: Request, res: Response, next: NextFunction): void {
  // En test, skip la vérification
  if (process.env['NODE_ENV'] === 'test') return next();

  const appSecret = process.env["META_APP_SECRET"] ?? process.env["FACEBOOK_APP_SECRET"];
  if (!appSecret) {
    // Si aucun secret configuré: log d'alerte mais ne bloque pas (dégradation gracieuse)
    logger.warn("[SocialWebhook] META_APP_SECRET not configured — HMAC verification skipped");
    return next();
  }

  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) {
    logger.warn("[SocialWebhook] Missing x-hub-signature-256 header");
    res.status(403).json({ error: "Missing signature" });
    return;
  }

  // Le body doit être le raw buffer pour vérification HMAC
  const rawBody: Buffer | undefined = req.rawBody;
  if (!rawBody) {
    logger.warn("[SocialWebhook] Raw body not available for HMAC verification");
    res.status(500).json({ error: "Cannot verify signature" });
    return;
  }

  const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn("[SocialWebhook] Invalid Meta HMAC signature");
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
  } catch {
    logger.warn("[SocialWebhook] HMAC comparison failed");
    res.status(403).json({ error: "Signature verification error" });
    return;
  }

  next();
}

// ─── FIX MED-2: Vérification signature TikTok ────────────────────────────────

function verifyTikTokSignature(req: Request, res: Response, next: NextFunction): void {
  if (process.env['NODE_ENV'] === 'test') return next();

  const clientSecret = process.env["TIKTOK_CLIENT_SECRET"];
  if (!clientSecret) {
    logger.warn("[SocialWebhook] TIKTOK_CLIENT_SECRET not configured — HMAC verification skipped");
    return next();
  }

  const timestamp = req.headers['x-tiktok-timestamp'] as string | undefined;
  const nonce = req.headers['x-tiktok-nonce'] as string | undefined;
  const signature = req.headers['x-tiktok-signature'] as string | undefined;

  if (!timestamp || !nonce || !signature) {
    logger.warn("[SocialWebhook] Missing TikTok signature headers");
    res.status(403).json({ error: "Missing TikTok signature headers" });
    return;
  }

  try {
    const rawBody: Buffer | undefined = req.rawBody;
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
    const signStr = `${clientSecret}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
    const expectedSig = crypto.createHmac('sha256', clientSecret).update(signStr).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn("[SocialWebhook] Invalid TikTok HMAC signature");
      res.status(403).json({ error: "Invalid TikTok signature" });
      return;
    }
  } catch {
    logger.warn("[SocialWebhook] TikTok HMAC comparison failed");
    res.status(403).json({ error: "Signature verification error" });
    return;
  }

  next();
}

// ─────────────────────────────────────────────
// Helper: Résoudre le tenant depuis la page/account ID
// ─────────────────────────────────────────────

async function resolveTenantFromPageId(pageId: string): Promise<{ tenantId: number; tenantName: string } | null> {
  try {
    const { db: getDb } = await import("../db");
    const db = await getDb();
    if (!db) return null;

    // Chercher via les socialAccounts — la page ID est dans platformAccountId
    const { socialAccounts } = await import("../../drizzle/schema-social");
    const { tenants } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const accounts = await db
      .select({ tenantId: socialAccounts.tenantId })
      .from(socialAccounts)
      .where(eq(socialAccounts.platformAccountId, pageId))
      .limit(1);

    if (!accounts[0]) {
      /**
       * FIX BLOC 0: Suppression du fallback vers le premier tenant actif.
       * Une requête externe doit être rejetée si le tenant n'est pas résolu.
       */
      logger.warn("[SocialWebhook] No tenant found for platformAccountId", { pageId });
      return null;
    }

    const tenantRow = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, accounts[0].tenantId)).limit(1);
    if (!tenantRow[0]) {
      logger.error("[SocialWebhook] Tenant referenced in socialAccounts not found", { tenantId: accounts[0].tenantId });
      return null;
    }
    return { tenantId: tenantRow[0].id, tenantName: tenantRow[0].name };
  } catch (err: unknown) {
    /**
     * FIX BLOC 0: Suppression du fallback vers DEFAULT_TENANT_ID.
     * En cas d'erreur de résolution, on rejette explicitement.
     */
    logger.error("[SocialWebhook] resolveTenant failed", { err, pageId });
    return null;
  }
}

// ─────────────────────────────────────────────
// Helper: Vérifier si l'auto-reply est activé pour ce tenant + plateforme
// ─────────────────────────────────────────────

async function isAutoReplyEnabled(tenantId: number, platform: string): Promise<boolean> {
  try {
    const { db: getDb } = await import("../db");
    const db = await getDb();
    if (!db) return false;

    const { tenants } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const [tenant] = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const channelSettings = (settings["channelSettings"] ?? {}) as Record<string, unknown>;
    const autoReply = (channelSettings["autoReply"] ?? {}) as Record<string, boolean>;
    return autoReply[platform] === true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// GET /api/social-webhook/meta — Vérification Meta
// ─────────────────────────────────────────────

router.get("/meta", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const verifyToken = process.env["META_WEBHOOK_VERIFY_TOKEN"] ?? process.env["WABA_WEBHOOK_VERIFY_TOKEN"] ?? "servicall_verify_token";

  if (mode === "subscribe" && token === verifyToken) {
    logger.info("[SocialWebhook] Meta verification OK");
    res.status(200).send(challenge);
  } else {
    logger.warn("[SocialWebhook] Meta verification failed", { mode, token });
    res.sendStatus(403);
  }
});

// ─────────────────────────────────────────────
// POST /api/social-webhook/meta — Messenger + Instagram
// FIX MED-2: verifyMetaSignature middleware ajouté ici
// ─────────────────────────────────────────────

router.post("/meta", verifyMetaSignature, async (req: Request, res: Response) => {
  // ACK immédiat requis par Meta (< 5s)
  res.sendStatus(200);

  try {
    const body = req.body as Record<string, unknown>;
    const objectType = body["object"] as string;

    // ── Messenger ──────────────────────────────────────
    if (objectType === "page") {
      const message = parseMetaMessengerWebhook(body);
      if (!message || !message.text) return;

      const isNew = await IdempotencyService.checkAndSet(message.messageId, "messenger");
      if (!isNew) return;

      const tenant = await resolveTenantFromPageId(message.recipientId);
      if (!tenant) {
        logger.warn("[SocialWebhook] Messenger message rejected: tenant not resolved", { recipientId: message.recipientId });
        return;
      }

      const enabled = await isAutoReplyEnabled(tenant.tenantId, "messenger");
      if (!enabled) {
        logger.info("[SocialWebhook] Messenger auto-reply disabled for tenant", { tenantId: tenant.tenantId });
        return;
      }

      logger.info("[SocialWebhook] Processing Messenger message", { from: message.senderId, tenantId: tenant.tenantId });
      await handleAutoReply(message, tenant.tenantId, tenant.tenantName);
      return;
    }

    // ── Instagram ──────────────────────────────────────
    if (objectType === "instagram") {
      const message = parseInstagramWebhook(body);
      if (!message || !message.text) return;

      const isNew = await IdempotencyService.checkAndSet(message.messageId, "instagram");
      if (!isNew) return;

      const tenant = await resolveTenantFromPageId(message.recipientId);
      if (!tenant) {
        logger.warn("[SocialWebhook] Instagram message rejected: tenant not resolved", { recipientId: message.recipientId });
        return;
      }

      const platformKey = message.platform === "instagram_comment" ? "instagram_comment" : "instagram_dm";
      const enabled = await isAutoReplyEnabled(tenant.tenantId, platformKey);
      if (!enabled) {
        logger.info("[SocialWebhook] Instagram auto-reply disabled for tenant", { tenantId: tenant.tenantId, platform: platformKey });
        return;
      }

      logger.info("[SocialWebhook] Processing Instagram message", { platform: message.platform, tenantId: tenant.tenantId });
      await handleAutoReply(message, tenant.tenantId, tenant.tenantName);
      return;
    }

    logger.debug("[SocialWebhook] Unknown Meta object type", { objectType });
  } catch (err: unknown) {
    logger.error("[SocialWebhook] Meta webhook error", { err });
  }
});

// ─────────────────────────────────────────────
// POST /api/social-webhook/tiktok — Commentaires TikTok
// FIX MED-2: verifyTikTokSignature middleware ajouté ici
// ─────────────────────────────────────────────

router.post("/tiktok", verifyTikTokSignature, async (req: Request, res: Response) => {
  res.sendStatus(200);

  try {
    const body = req.body as Record<string, unknown>;
    const message = parseTikTokCommentWebhook(body);
    if (!message || !message.text) return;

    const isNew = await IdempotencyService.checkAndSet(message.messageId, "tiktok-comment");
    if (!isNew) return;

    const tenant = await resolveTenantFromPageId(message.recipientId);
    if (!tenant) {
      logger.warn("[SocialWebhook] TikTok comment rejected: tenant not resolved", { recipientId: message.recipientId });
      return;
    }

    const enabled = await isAutoReplyEnabled(tenant.tenantId, "tiktok_comment");
    if (!enabled) {
      logger.info("[SocialWebhook] TikTok auto-reply disabled for tenant", { tenantId: tenant.tenantId });
      return;
    }

    logger.info("[SocialWebhook] Processing TikTok comment", { commentId: message.commentId, tenantId: tenant.tenantId });
    await handleAutoReply(message, tenant.tenantId, tenant.tenantName);
  } catch (err: unknown) {
    logger.error("[SocialWebhook] TikTok webhook error", { err });
  }
});

export default router;
