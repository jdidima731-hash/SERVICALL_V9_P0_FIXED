import { ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { AuthService, AuthenticatedUser } from "../services/authService";
import { logger } from "../infrastructure/logger";
import { redisStateManager } from "../infrastructure/redis/redisStateManager";

/**
 * SDK Server - Gestion locale des sessions SECURISEE
 *
 * CORRECTION CRITIQUE:
 * - Les tokens JWT ne sont PAS révoqués à la création (login).
 * - La révocation se fait UNIQUEMENT au logout via revokeToken().
 * - Le store Redis (avec fallback mémoire) remplace la variable `db` non définie.
 */

export type SessionPayload = {
  openId: string;
  name: string;
  issuedAtSeconds: number;
  jti?: string;
};

// ✅ FIX P1.3: Utiliser RedisStateManager au lieu de Map en mémoire
async function addRevokedTokenToStore(jti: string, expiresAtSeconds: number): Promise<void> {
  await redisStateManager.addRevokedToken(jti, expiresAtSeconds);
}

async function isTokenRevokedInStore(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  return await redisStateManager.isTokenRevoked(jti);
}

class SDKServer {
  private getSessionSecret() {
    const secret = process.env["JWT_SECRET"];
    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET is not configured or too weak");
    }
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    const jti = crypto.randomUUID();

    // ✅ CORRECTION: Le token N'EST PAS révoqué ici.
    // Il est ajouté au store Redis UNIQUEMENT lors du logout via revokeToken().

    return await new SignJWT({ openId, name: options.name ?? "" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setJti(jti)
      .sign(secretKey);
  }

  /**
   * Révoque un token JWT (à appeler lors du logout).
   * Stocke le jti dans Redis avec TTL = durée restante du token.
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });
      const jti = payload.jti as string;
      const exp = payload.exp as number;
      if (jti && exp) {
        await addRevokedTokenToStore(jti, exp);
        logger.info("[SDK] Token révoqué au logout", { jti });
      }
    } catch (err: any) {
      // Token déjà expiré ou invalide → pas besoin de révoquer
      logger.debug("[SDK] revokeToken: token invalide ou déjà expiré, révocation ignorée");
    }
  }

  async verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
    if (!token) return null;

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });

      // Vérifie si le token a été révoqué (logout explicite)
      const isRevoked = await isTokenRevokedInStore(payload.jti as string);
      if (isRevoked) {
        return null;
      }

      const { openId, name, iat, jti } = payload as Record<string, unknown>;
      if (!openId || typeof openId !== "string") return null;
      if (typeof iat !== "number") return null;

      return {
        openId,
        name: (name as string) || "",
        issuedAtSeconds: iat,
        jti: typeof jti === "string" ? jti : undefined,
      };
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Authentifie une requete via le cookie de session
   */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const authResult = await AuthService.authenticateRequest(req);
    if (!authResult) {
      throw new ForbiddenError("Invalid or expired session");
    }
    return authResult.user;
  }
}

export const sdk = new SDKServer();
