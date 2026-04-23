import { Router, Request, Response } from "express";
import { forceHumanAgent, forceAIAgent } from "../services/agentSwitchService";
import { logger } from "../infrastructure/logger";
import { sdk } from "../_core/sdk";
import { apiLimiter } from "../middleware/rateLimit";

const router = Router();

/**
 * Middleware d'authentification pour les routes internes d'agent
 * Seuls les utilisateurs authentifiés avec un rôle suffisant peuvent forcer une bascule
 */
const internalAuth = async (req: Request, res: Response, next: (err?: any) => void): Promise<void> => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      res.status(403).json({ error: "Forbidden: Admin or Manager role required" });
      return;
    }
    (req as any).user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ error: "Unauthorized" });
  }
};

router.use(apiLimiter);
router.use(internalAuth);

/**
 * Endpoint pour forcer la bascule vers un agent humain
 */
router.post("/force-human", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { userId, tenantId: bodyTenantId, reason, callId } = req.body;
    const triggeredByUserId = user.id;
    const userTenantId = user.tenantId;

    // DURCI: Forcer l'isolation tenant si l'utilisateur n'est pas superadmin
    const effectiveTenantId = user.role === "superadmin" ? bodyTenantId : userTenantId;

    if (!userId || !effectiveTenantId) {
      return res.status(400).json({ success: false, error: "userId and tenantId are required" });
    }

    // Assertion de sécurité
    if (bodyTenantId && bodyTenantId !== userTenantId && user.role !== "superadmin") {
      logger.warn("[Security] Cross-tenant attempt blocked in agentSwitch", { userId: triggeredByUserId, targetTenant: bodyTenantId });
      return res.status(403).json({ error: "Forbidden: Cross-tenant access denied" });
    }

    await forceHumanAgent(userId, effectiveTenantId, triggeredByUserId, reason, callId);

    return res.status(200).json({ success: true, message: "Agent switched to HUMAN" });
  } catch (error: any) {
    logger.error("[API AgentSwitch] Failed to force human agent", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/**
 * Endpoint pour forcer la bascule vers un agent IA
 */
router.post("/force-ai", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { userId, tenantId: bodyTenantId, reason, callId } = req.body;
    const triggeredByUserId = user.id;
    const userTenantId = user.tenantId;

    const effectiveTenantId = user.role === "superadmin" ? bodyTenantId : userTenantId;

    if (!userId || !effectiveTenantId) {
      return res.status(400).json({ success: false, error: "userId and tenantId are required" });
    }

    if (bodyTenantId && bodyTenantId !== userTenantId && user.role !== "superadmin") {
      logger.warn("[Security] Cross-tenant attempt blocked in agentSwitch", { userId: triggeredByUserId, targetTenant: bodyTenantId });
      return res.status(403).json({ error: "Forbidden: Cross-tenant access denied" });
    }

    await forceAIAgent(userId, effectiveTenantId, triggeredByUserId, reason, callId);

    return res.status(200).json({ success: true, message: "Agent switched to AI" });
  } catch (error: any) {
    logger.error("[API AgentSwitch] Failed to force AI agent", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
