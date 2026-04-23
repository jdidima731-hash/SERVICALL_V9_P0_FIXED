import type { Request, Response } from "express";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { SignJWT } from "jose";
import { logger } from '../core/logger/index';

const JWT_SECRET = process.env['JWT_SECRET'];
const MODE_TEST = process.env['MODE_TEST'] === "true";

/**
 * Endpoint de test ultra-simplifié pour éviter les blocages DB
 */
export async function testLoginHandler(req: Request, res: Response): Promise<void> {
  // H-4: Hard block in production regardless of MODE_TEST env var
  if (process.env.NODE_ENV === 'production') {
    logger.warn("[TestLogin] Attempt to access test endpoint in production — blocked");
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  logger.info("[TestLogin] Request received");

  if (!MODE_TEST) {
    res.status(403).json({
      error: "Test mode is not enabled",
    });
    return;
  }

  try {
    // Utiliser des IDs statiques pour le test
    const testUser = { id: 1, email: "admin@example.com", role: "admin" };
    const testTenant = { id: 1 };

    logger.info("[TestLogin] Generating JWT...");
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({
      userId: testUser.id,
      email: testUser.email,
      role: testUser.role,
      tenantId: testTenant.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    logger.info("[TestLogin] Setting cookie...");
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info("[TestLogin] Redirecting...");
    res.redirect(`/connected?tenantId=${testTenant.id}`);
  } catch (error: any) {
    logger.error("[TestLogin] Error:", error);
    res.status(500).json({
      error: "Failed to create test session",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
