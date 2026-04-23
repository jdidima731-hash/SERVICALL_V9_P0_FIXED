/**
 * HEALTHCHECK ROUTER
 * Endpoint pour monitorer l'état du service en production
 */

import { Router } from "express";
import { dbManager } from "../services/dbManager";
import { logger } from "../infrastructure/logger";

const router = Router();

router.get("/health", async (_req, res) => {
  const healthStatus = {
    status: "UP",
    timestamp: new Date().toISOString(),
    services: {
      database: "UNKNOWN",
      uptime: process.uptime(),
    }
  };

  try {
    // Vérifier la connexion DB
    const isDbAlive = await dbManager.db.execute("SELECT 1");
    if (isDbAlive) {
      healthStatus.services.database = "UP";
    }
  } catch (error: any) {
    healthStatus.status = "DEGRADED";
    healthStatus.services.database = "DOWN";
    logger.error("[Healthcheck] Database connection failed", { error });
  }

  const statusCode = healthStatus.status === "UP" ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

export default router;
