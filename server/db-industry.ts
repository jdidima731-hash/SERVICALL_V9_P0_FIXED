/**
 * DATABASE FUNCTIONS FOR INDUSTRY CONFIGURATION & AI KEY MANAGEMENT
 * PostgreSQL only
 */

import { eq } from "drizzle-orm";
import { getDbInstance } from "./db";
import { logger } from "./infrastructure/logger";
import { tenantIndustryConfig, tenantAiKeys } from "../drizzle/schema-tenant";

// Types
export interface TenantIndustryConfigData {
  industryId: string;
  enabledCapabilities: string[];
  enabledWorkflows: string[];
  aiSystemPrompt: string;
}

// ============================================
// TENANT INDUSTRY CONFIG FUNCTIONS
// ============================================

/**
 * Récupère la configuration métier d'un tenant
 */
export async function getTenantIndustryConfig(tenantId: number) {
  try {
    const db = getDbInstance();
    if (!db) return null;

    const result = await db
      .select()
      .from(tenantIndustryConfig)
      .where(eq(tenantIndustryConfig.tenantId, tenantId))
      .limit(1);

    if (result.length === 0) return null;

    const config = result[0] ?? null;
    
    // PostgreSQL stocke directement les tableaux JSON
    return {
      ...config,
      enabledCapabilities: config.enabledCapabilities,
      enabledWorkflows: config.enabledWorkflows,
    };
  } catch (error: any) {
    logger.error("[Database] Failed to get tenant industry config", { error, tenantId });
    return null;
  }
}

/**
 * Sauvegarde la configuration métier d'un tenant
 */
export async function saveTenantIndustryConfig(
  tenantId: number,
  config: TenantIndustryConfigData
): Promise<void> {
  try {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    // Vérifier si la config existe déjà
    const existing = await getTenantIndustryConfig(tenantId);

    const values = {
      tenantId,
      industryId: config.industryId,
      // PostgreSQL supporte nativement les types JSON
      enabledCapabilities: config.enabledCapabilities,
      enabledWorkflows: config.enabledWorkflows,
      aiSystemPrompt: config.aiSystemPrompt,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(tenantIndustryConfig)
        .set(values)
        .where(eq(tenantIndustryConfig.tenantId, tenantId));
    } else {
      await db.insert(tenantIndustryConfig).values(values);
    }

    logger.info("[Database] Tenant industry config saved", { tenantId, industryId: config.industryId });
  } catch (error: any) {
    logger.error("[Database] Failed to save tenant industry config", { error, tenantId });
    throw error;
  }
}

/**
 * Supprime la configuration métier d'un tenant
 */
export async function deleteTenantIndustryConfig(tenantId: number): Promise<void> {
  try {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    await db
      .delete(tenantIndustryConfig)
      .where(eq(tenantIndustryConfig.tenantId, tenantId));

    logger.info("[Database] Tenant industry config deleted", { tenantId });
  } catch (error: any) {
    logger.error("[Database] Failed to delete tenant industry config", { error, tenantId });
    throw error;
  }
}

// ============================================
// TENANT AI KEY FUNCTIONS
// ============================================

/**
 * Récupère la clé AI d'un tenant
 */
export async function getTenantAiKey(tenantId: number, provider: string = "openai") {
  try {
    const db = getDbInstance();
    if (!db) return null;

    const result = await db
      .select()
      .from(tenantAiKeys)
      .where(eq(tenantAiKeys.tenantId, tenantId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error: any) {
    logger.error("[Database] Failed to get tenant AI key", { error, tenantId, provider });
    return null;
  }
}

/**
 * Sauvegarde la clé AI chiffrée d'un tenant
 */
export async function saveTenantAiKey(
  tenantId: number,
  provider: string,
  encryptedKey: string,
  keyHash: string
): Promise<void> {
  try {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    const existing = await getTenantAiKey(tenantId, provider);

    const values = {
      tenantId,
      provider,
      encryptedKey,
      keyHash,
      isActive: true,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(tenantAiKeys)
        .set(values)
        .where(eq(tenantAiKeys.tenantId, tenantId));
    } else {
      await db.insert(tenantAiKeys).values(values);
    }

    logger.info("[Database] Tenant AI key saved", { tenantId, provider });
  } catch (error: any) {
    logger.error("[Database] Failed to save tenant AI key", { error, tenantId, provider });
    throw error;
  }
}

/**
 * Supprime la clé AI d'un tenant
 */
export async function deleteTenantAiKey(tenantId: number, provider: string = "openai"): Promise<void> {
  try {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    await db
      .delete(tenantAiKeys)
      .where(eq(tenantAiKeys.tenantId, tenantId));

    logger.info("[Database] Tenant AI key deleted", { tenantId, provider });
  } catch (error: any) {
    logger.error("[Database] Failed to delete tenant AI key", { error, tenantId, provider });
    throw error;
  }
}
