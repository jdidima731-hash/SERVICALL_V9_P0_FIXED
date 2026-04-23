/**
 * AUTH SERVICE — SERVICALL V8
 * ─────────────────────────────────────────────────────────────
 * Service canonique pour l'authentification et la gestion des utilisateurs.
 * ✅ BLOC 3 FIX: Typage strict et suppression des 'any'
 */

import * as db from "../db";
import { logger } from "../infrastructure/logger";
import { User, users, tenants, tenantUsers } from "../../drizzle/schema";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "../_core/sdk";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { verifyPassword, hashPassword } from "./passwordService";

export interface AuthenticatedUser extends Omit<User, 'role'> {
  tenantId: number | null;
  role: 'admin' | 'manager' | 'agent' | 'viewer' | 'superadmin' | 'owner' | 'user';
}

export const AuthService = {
  /**
   * Authentifie un utilisateur par email/password (Login)
   */
  async login(email: string, password: string) {
    const [user] = await db.db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants invalides" });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Identifiants invalides" });
    }

    return {
      ...user,
      role: (user.role === 'owner' ? 'admin' : user.role) as AuthenticatedUser['role'],
    };
  },

  /**
   * Enregistre un nouvel utilisateur et lui crée un tenant par défaut
   */
  async register(data: { name: string; email: string; password: string }) {
    const [existing] = await db.db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà avec cet email" });
    }

    const passwordHash = await hashPassword(data.password);
    const [user] = await db.db.insert(users).values({
      openId: `local_${Date.now()}`,
      name: data.name,
      email: data.email,
      passwordHash,
      role: "admin",
    }).returning();

    if (!user) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la création du compte" });
    }

    // Auto-création du tenant
    try {
      const slugBase = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 30) || 'mon-entreprise';
      const slug = `${slugBase}-${Date.now().toString(36)}`;
      
      const [newTenant] = await db.db.insert(tenants).values({
        name: data.name,
        slug,
        settings: { timezone: 'Europe/Paris', language: 'fr' },
      }).returning();

      if (newTenant) {
        await db.db.insert(tenantUsers).values({
          userId: user.id,
          tenantId: newTenant.id,
          role: 'admin',
        });
        logger.info('[AuthService] Auto-created tenant for new user', { userId: user.id, tenantId: newTenant.id });
      }
    } catch (tenantError: unknown) {
      const message = tenantError instanceof Error ? tenantError.message : String(tenantError);
      logger.warn('[AuthService] Failed to auto-create tenant', { userId: user.id, error: message });
    }

    return user;
  },

  /**
   * Liste les tenants d'un utilisateur
   */
  async getUserTenants(userId: number) {
    return await db.db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      role: tenantUsers.role,
      isActive: tenants.isActive,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
    .where(eq(tenantUsers.userId, userId));
  },

  async verifyUserSession(userId: number, tenantId: number): Promise<AuthenticatedUser | null> {
    try {
      const user = await db.getUserById(userId);
      if (!user) return null;

      const [tenantUser] = await db.db.select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId)))
        .limit(1);

      if (!tenantUser || !tenantUser.isActive) return null;

      return {
        ...user,
        tenantId: tenantUser.tenantId,
        role: (tenantUser.role === 'owner' ? 'admin' : tenantUser.role) as AuthenticatedUser['role'],
      };
    } catch (error: unknown) {
      logger.error("[AuthService] Error verifying user session", { userId, tenantId, error });
      return null;
    }
  },

  /**
   * Authentifie une requête HTTP à partir du cookie de session JWT.
   */
  async authenticateRequest(req: Request): Promise<{ user: AuthenticatedUser; tenantId: number | null } | null> {
    const sessionCookie = req.cookies?.[COOKIE_NAME] || req.signedCookies?.[COOKIE_NAME];
    const session = await sdk.verifySession(sessionCookie);

    if (!session) return null;

    const user = await db.getUserById(session.openId);
    if (!user) return null;

    if (user.tokensValidAfter instanceof Date) {
      const tokenIssuedAtMs = session.issuedAtSeconds * 1000;
      if (tokenIssuedAtMs < user.tokensValidAfter.getTime()) {
        logger.warn("[AuthService] Session rejected because token was issued before tokens_valid_after", {
          userId: user.id,
          tokenIssuedAt: new Date(tokenIssuedAtMs).toISOString(),
          tokensValidAfter: user.tokensValidAfter.toISOString(),
        });
        return null;
      }
    }

    if (user.role === 'superadmin') {
      const superAdminUser: AuthenticatedUser = {
        ...user,
        tenantId: -1,
        role: 'superadmin',
      };
      return { user: superAdminUser, tenantId: -1 };
    }

    const tenantUsersList = await this.getUserTenants(user.id);
    const tenantCookie = req.cookies?.["servicall_tenant"];
    let activeTenantId: number | null = null;
    
    if (tenantCookie) {
      const { verifyTenantToken } = await import("../services/tenantService");
      const payload = await verifyTenantToken(tenantCookie);
      if (payload && payload.userId === user.id) {
        activeTenantId = payload.tenantId;
      }
    }
    
    const activeTenant = activeTenantId 
      ? tenantUsersList.find(t => t.id === activeTenantId) 
      : tenantUsersList.find(t => t.isActive);

    if (!activeTenant) {
      logger.warn("[AuthService] User has no active tenant — returning null tenantId", { userId: user.id, openId: session.openId });
      const noTenantUser: AuthenticatedUser = {
        ...user,
        tenantId: null,
        role: (user.role === 'owner' ? 'admin' : user.role) as AuthenticatedUser['role'],
      };
      return { user: noTenantUser, tenantId: null };
    }

    const authenticatedUser = await this.verifyUserSession(user.id, activeTenant.id);
    if (!authenticatedUser) return null;

    return { user: authenticatedUser, tenantId: authenticatedUser.tenantId };
  },
};
