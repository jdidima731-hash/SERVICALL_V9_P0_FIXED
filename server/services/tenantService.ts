/**
 * Tenant Service - Gestion sécurisée du tenantId
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 */

import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { logger } from "../infrastructure/logger";
import { db, tenants, tenantUsers, type Tenant, type InsertTenant, type InsertTenantUser } from "../db";
import { eq, and } from "drizzle-orm";
import type { TenantSettings } from "../../shared/validation/tenant";
import type { Role } from "./rbacService";

const TENANT_COOKIE_NAME = "servicall_tenant";
const TENANT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function getTenantJwtSecret(): string | undefined {
  return process.env['TENANT_JWT_SECRET'] || process.env['ENCRYPTION_KEY'];
}

export interface TenantPayload {
  tenantId: number;
  userId: number;
  role: Role;
  issuedAt: number;
}

export async function createTenantToken(
  tenantId: number,
  userId: number,
  role: Role
): Promise<string> {
  const tenantJwtSecret = getTenantJwtSecret();
  if (!tenantJwtSecret) {
    throw new Error("[TenantService] TENANT_JWT_SECRET is not configured — cannot issue tenant token");
  }
  const secretKey = new TextEncoder().encode(tenantJwtSecret);
  const issuedAt = Date.now();
  
  return await new SignJWT({ tenantId, userId, role, issuedAt })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime("30d")
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .sign(secretKey);
}

export async function verifyTenantToken(token: string): Promise<TenantPayload | null> {
  try {
    const tenantJwtSecret = getTenantJwtSecret();
    if (!tenantJwtSecret) {
      logger.error("[TenantService] TENANT_JWT_SECRET is not configured — cannot verify tenant token");
      return null;
    }
    const secretKey = new TextEncoder().encode(tenantJwtSecret);
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    
    // Validation structurelle stricte sans assertion aveugle
    if (
      typeof payload.tenantId === 'number' &&
      typeof payload.userId === 'number' &&
      typeof payload.role === 'string' &&
      typeof payload.issuedAt === 'number'
    ) {
      return {
        tenantId: payload.tenantId,
        userId: payload.userId,
        role: payload.role as Role,
        issuedAt: payload.issuedAt
      };
    }
    return null;
  } catch (error: unknown) {
    logger.debug("[TenantService] Token verification failed", { error });
    return null;
  }
}

export function setTenantCookie(res: Response, token: string): void {
  const isProduction = process.env['NODE_ENV'] === "production";
  res.cookie(TENANT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: TENANT_COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearTenantCookie(res: Response): void {
  const isProduction = process.env['NODE_ENV'] === "production";
  res.clearCookie(TENANT_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

export function getTenantCookie(req: Request): string | null {
  return (req.cookies as Record<string, string>)?.[TENANT_COOKIE_NAME] || null;
}

export async function extractTenantContext(req: Request): Promise<TenantPayload | null> {
  const token = getTenantCookie(req);
  if (token) {
    const payload = await verifyTenantToken(token);
    if (payload) return payload;
  }
  return null;
}

export async function switchTenant(userId: number, tenantId: number, res: Response): Promise<{ success: boolean; error?: string }> {
  const [userTenant] = await db.select().from(tenantUsers).where(and(eq(tenantUsers.userId, userId), eq(tenantUsers.tenantId, tenantId))).limit(1);
  if (!userTenant) return { success: false, error: "Accès refusé" };
  
  const role = (userTenant.role as Role) || "agent";
  const token = await createTenantToken(tenantId, userId, role);
  setTenantCookie(res, token);
  return { success: true };
}

export async function initializeDefaultTenant(userId: number, res: Response): Promise<{ tenantId: number; role: string | null } | null> {
  const userTenantsList = await TenantService.getUserTenants(userId);
  if (userTenantsList.length === 0) return null;
  const defaultTenant = userTenantsList[0];
  if (!defaultTenant) return null;

  const role = (defaultTenant.role as Role) || "agent";
  const token = await createTenantToken(defaultTenant.id, userId, role);
  setTenantCookie(res, token);
  return { tenantId: defaultTenant.id, role: defaultTenant.role };
}

/**
 * TenantService Class for CRUD operations
 */
export class TenantService {
  static async getById(id: number): Promise<Tenant | null> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant || null;
  }

  static async getUserTenants(userId: number) {
    return await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      role: tenantUsers.role,
      isActive: tenants.isActive,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
    .where(eq(tenantUsers.userId, userId));
  }

  static async create(data: { name: string; slug: string; settings: TenantSettings }, userId: number) {
    const tenantValues: InsertTenant = {
      name: data.name,
      slug: data.slug,
      settings: data.settings,
    };
    const [newTenant] = await db.insert(tenants).values(tenantValues).returning();

    if (newTenant) {
      const userValues: InsertTenantUser = {
        userId,
        tenantId: newTenant.id,
        role: 'admin',
      };
      await db.insert(tenantUsers).values(userValues);
    }
    return newTenant;
  }

  static async update(id: number, data: Partial<InsertTenant>) {
    const [updated] = await db.update(tenants)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }
}
