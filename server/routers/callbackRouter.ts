import { Router, Request, Response } from "express";
import { getDbInstance } from "../db";
import { scheduledCallbacks } from "../../drizzle/schema-calls";
import { users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../infrastructure/logger";
import { sdk } from "../_core/sdk";
import { apiLimiter } from "../middleware/rateLimit";
import { createOutboundCall } from "../services/twilioService";
import { ENV } from "../_core/env";

/**
 * CALLBACK ROUTER — Thin Router (BLOC 3)
 * ✅ Suppression de toute orchestration Twilio directe
 * ✅ Redirection vers TwilioService (Gateway canonique)
 */

const router = Router();
router.use(apiLimiter);

// ── Auth middleware ────────────────────────────────────────────────────────────
const requireAuth = async (req: Request, res: Response, next: (err?: any) => void): Promise<void> => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

router.use(requireAuth);

// ── GET /api/callbacks — Liste des rappels ─────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as unknown).tenantId;
    const db = getDbInstance();

    const statusFilter = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string ?? "50"), 200);

    const callbacks = await db
      .select()
      .from(scheduledCallbacks)
      .where(eq(scheduledCallbacks.tenantId, tenantId))
      .orderBy(desc(scheduledCallbacks.scheduledAt))
      .limit(limit);

    const filtered = statusFilter
      ? callbacks.filter((c) => c.status === statusFilter)
      : callbacks;

    return res.json({ success: true, data: filtered, total: filtered.length });
  } catch (err: any) {
    logger.error("[CallbackRouter] GET / failed", { err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/callbacks/config — Config rappel utilisateur ─────────────────────
router.get("/config", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as unknown).id;
    const db = getDbInstance();

    const [user] = await db
      .select({
        callbackPhone: users.callbackPhone,
        callbackNotifyMode: users.callbackNotifyMode,
        isAvailableForTransfer: users.isAvailableForTransfer,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return res.json({
      success: true,
      data: {
        callbackPhone: user?.callbackPhone ?? null,
        callbackNotifyMode: user?.callbackNotifyMode ?? "crm",
        isAvailableForTransfer: user?.isAvailableForTransfer ?? true,
      },
    });
  } catch (err: any) {
    logger.error("[CallbackRouter] GET /config failed", { err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/callbacks/config — Mettre à jour la config rappel ────────────────
router.put("/config", async (req: Request, res: Response) => {
  try {
    const userId = (req.user as unknown).id;
    const db = getDbInstance();

    const { callbackPhone, callbackNotifyMode, isAvailableForTransfer } = req.body;

    if (callbackPhone && !/^\+?[\d\s\-().]{7,20}$/.test(callbackPhone)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    const validModes = ["crm", "phone", "both"];
    if (callbackNotifyMode && !validModes.includes(callbackNotifyMode)) {
      return res.status(400).json({ error: "Invalid notify mode" });
    }

    await db
      .update(users)
      .set({
        ...(callbackPhone !== undefined && { callbackPhone }),
        ...(callbackNotifyMode !== undefined && { callbackNotifyMode }),
        ...(isAvailableForTransfer !== undefined && { isAvailableForTransfer }),
        updatedAt: new Date(),
      } as unknown)
      .where(eq(users.id, userId));

    return res.json({ success: true, message: "Configuration mise à jour" });
  } catch (err: any) {
    logger.error("[CallbackRouter] PUT /config failed", { err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/callbacks/:id/execute — Déclencher le rappel immédiatement ──────
router.post("/:id/execute", async (req: Request, res: Response) => {
  try {
    const tenantId = (req.user as unknown).tenantId;
    const callbackId = parseInt(req.params.id);
    const db = getDbInstance();

    const [callback] = await db
      .select()
      .from(scheduledCallbacks)
      .where(and(
        eq(scheduledCallbacks.id, callbackId),
        eq(scheduledCallbacks.tenantId, tenantId)
      ))
      .limit(1);

    if (!callback) return res.status(404).json({ error: "Callback not found" });
    if (callback.status === "completed" || callback.status === "cancelled") {
      return res.status(400).json({ error: `Cannot execute a ${callback.status} callback` });
    }

    const webhookBase = (ENV.appUrl || "").replace(/\/$/, "");
    if (!webhookBase) return res.status(503).json({ error: "APP_URL non configurée" });

    // ✅ BLOC 3 : Utilisation de la gateway canonique
    const callSid = await createOutboundCall({
      tenantId,
      to: callback.prospectPhone,
      url: `${webhookBase}/api/twilio/incoming-call`,
      statusCallback: `${webhookBase}/api/twilio/call-status`,
    });

    await db
      .update(scheduledCallbacks)
      .set({
        status: "called",
        callbackCallSid: callSid,
        updatedAt: new Date(),
      } as unknown)
      .where(eq(scheduledCallbacks.id, callbackId));

    logger.info("[CallbackRouter] Callback executed via Gateway", { callbackId, callSid });

    return res.json({ success: true, data: { callSid } });
  } catch (err: any) {
    logger.error("[CallbackRouter] POST /:id/execute failed", { err });
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
});

export const callbackRouter = router;
export default router;
