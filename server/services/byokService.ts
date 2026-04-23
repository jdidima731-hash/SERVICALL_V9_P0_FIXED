/**
 * BYOK Service - Bring Your Own Key
 * Gestion centralisée et sécurisée des clés API avec chiffrement AES-256-GCM
 */

import crypto from "crypto";
import { db } from "../db";
import { apiKeys, byokAuditLogs } from "../../drizzle/schema-byok-services";
import { eq, and } from "drizzle-orm";
import { logger } from "../infrastructure/logger";

// ✅ SÉCURITÉ RENFORCÉE: Utilisation d'AES-256-GCM avec dérivation de clé scrypt
// ✅ FIX P0: Utilisation des variables d'environnement centralisées
import { ENV } from '../_core/env';

const _byokSalt = ENV.encryptionSalt || "servicall-byok-default-salt";

function getByokEncryptionKey(): string {
  const byokEncryptionKey = ENV.encryptionKey;
  if (!byokEncryptionKey) {
    throw new Error('[BYOKService] ENCRYPTION_KEY est requis pour les opérations de chiffrement BYOK.');
  }
  return byokEncryptionKey;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommandé pour GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Dérive une clé de 32 octets à partir de la variable d'environnement
 */
function getDerivedKey(): Buffer {
  return crypto.scryptSync(getByokEncryptionKey(), _byokSalt, 32);
}

/**
 * Chiffrer une clé API (AES-256-GCM)
 */
export function encryptKey(key: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const derivedKey = getDerivedKey();
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let encrypted = cipher.update(key, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    // ✅ FIX P0: Format unifié avec le reste du système (separateur '|')
    // Format: encrypted|iv|authTag
    return `${encrypted}|${iv.toString("hex")}|${authTag}`;
  } catch (error: any) {
    logger.error("[BYOK] Encryption failed:", error);
    throw new Error("Failed to encrypt key");
  }
}

/**
 * Déchiffrer une clé API (AES-256-GCM)
 */
export function decryptKey(encryptedData: string): string {
  try {
    // ✅ FIX P0: Support des deux formats pendant la transition (':' et '|')
    const separator = encryptedData.includes('|') ? '|' : ':';
    const parts = encryptedData.split(separator);
    
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format (expected 3 parts)");
    }

    let encrypted: string;
    let iv: Buffer;
    let authTag: Buffer;

    if (separator === '|') {
      // Nouveau format unifié: encrypted|iv|authTag
      encrypted = parts[0]!;
      iv = Buffer.from(parts[1]!, "hex");
      authTag = Buffer.from(parts[2]!, "hex");
    } else {
      // Ancien format byokService: iv:authTag:encrypted
      iv = Buffer.from(parts[0]!, "hex");
      authTag = Buffer.from(parts[1]!, "hex");
      encrypted = parts[2]!;
    }
    const derivedKey = getDerivedKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error: any) {
    logger.error("[BYOK] Decryption failed:", error);
    throw new Error("Failed to decrypt key - integrity check failed");
  }
}

/**
 * Sauvegarder une clé API
 */
export async function saveAPIKey(
  tenantId: number,
  provider: string,
  key: string
): Promise<{ success: boolean; message: string }> {
  try {
    const encryptedKey = encryptKey(key);

    // Vérifier si la clé existe déjà
    const existing = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, provider)))
      .limit(1);

    if (existing.length > 0) {
      // Mettre à jour
      await db
        .update(apiKeys)
        .set({ encryptedKey, updatedAt: new Date() })
        .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, provider)));
    } else {
      // Créer
      await db.insert(apiKeys).values({
        tenantId,
        provider,
        encryptedKey,
        isActive: true,
      });
    }

    // Audit log
    await logAuditAction(tenantId, "create", provider, "success", "API key saved (GCM)");

    return { success: true, message: "API key saved successfully" };
  } catch (error: any) {
    logger.error("[BYOK] Save failed:", error);
    await logAuditAction(tenantId, "create", provider, "failed", String(error));
    return { success: false, message: "Failed to save API key" };
  }
}

/**
 * Récupérer une clé API déchiffrée
 */
export async function getAPIKey(tenantId: number, provider: string): Promise<string | null> {
  try {
    const result = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, provider), eq(apiKeys.isActive, true)))
      .limit(1);

    if (result.length === 0) return null;

    return decryptKey(result[0]!.encryptedKey);
  } catch (error: any) {
    logger.error("[BYOK] Retrieval failed:", error);
    return null;
  }
}

/**
 * Lister toutes les clés API (sans les valeurs)
 */
export async function listAPIKeys(tenantId: number) {
  try {
    const results = await db
      .select({
        id: apiKeys.id,
        provider: apiKeys.provider,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId));

    return results;
  } catch (error: any) {
    logger.error("[BYOK] List failed:", error);
    return [];
  }
}

/**
 * Supprimer une clé API
 */
export async function deleteAPIKey(tenantId: number, provider: string): Promise<boolean> {
  try {
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.provider, provider)));

    await logAuditAction(tenantId, "delete", provider, "success", "API key deleted");
    return true;
  } catch (error: any) {
    logger.error("[BYOK] Delete failed:", error);
    await logAuditAction(tenantId, "delete", provider, "failed", String(error));
    return false;
  }
}

/**
 * Tester une clé API
 */
export async function testAPIKey(provider: string, key: string): Promise<{ success: boolean; message: string }> {
  try {
    switch (provider) {
      case "google_maps":
        return await testGoogleMapsKey(key);
      case "pages_jaunes":
        return await testPagesJaunesKey(key);
      case "openai":
        return await testOpenAIKey(key);
      case "stripe":
        return await testStripeKey(key);
      case "sendgrid":
        return await testSendGridKey(key);
      default:
        return { success: false, message: "Unknown provider" };
    }
  } catch (error: any) {
    logger.error("[BYOK] Test failed:", error);
    return { success: false, message: String(error) };
  }
}

async function testGoogleMapsKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=" + key);
    if (response.ok || response.status === 400) {
      return { success: true, message: "Google Maps key is valid" };
    }
    return { success: false, message: "Invalid Google Maps key" };
  } catch (error: any) {
    return { success: false, message: String(error) };
  }
}

async function testPagesJaunesKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://api.pagesjaunes.fr/search?apiKey=" + key + "&keyword=test");
    if (response.ok || response.status === 400) {
      return { success: true, message: "Pages Jaunes key is valid" };
    }
    return { success: false, message: "Invalid Pages Jaunes key" };
  } catch (error: any) {
    return { success: false, message: String(error) };
  }
}

async function testOpenAIKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (response.ok) {
      return { success: true, message: "OpenAI key is valid" };
    }
    return { success: false, message: "Invalid OpenAI key" };
  } catch (error: any) {
    return { success: false, message: String(error) };
  }
}

async function testStripeKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (response.ok) {
      return { success: true, message: "Stripe key is valid" };
    }
    return { success: false, message: "Invalid Stripe key" };
  } catch (error: any) {
    return { success: false, message: String(error) };
  }
}

async function testSendGridKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: "test@example.com" }] }],
        from: { email: "test@example.com" },
        subject: "Test",
        content: [{ type: "text/plain", value: "Test" }],
      }),
    });
    if (response.status === 202 || response.status === 400) {
      return { success: true, message: "SendGrid key is valid" };
    }
    return { success: false, message: "Invalid SendGrid key" };
  } catch (error: any) {
    return { success: false, message: String(error) };
  }
}

/**
 * Enregistrer une action d'audit
 */
async function logAuditAction(
  tenantId: number,
  action: string,
  provider: string,
  status: string,
  message: string
): Promise<void> {
  try {
    await db.insert(byokAuditLogs).values({
      tenantId,
      action,
      provider,
      status,
      message,
    });
  } catch (error: any) {
    logger.error("[BYOK] Audit log failed:", error);
  }
}

/**
 * Récupérer les logs d'audit
 */
export async function getAuditLogs(tenantId: number, limit = 50) {
  try {
    const results = await db
      .select()
      .from(byokAuditLogs)
      .where(eq(byokAuditLogs.tenantId, tenantId))
      .orderBy((t: any) => t.createdAt)
      .limit(limit);

    return results;
  } catch (error: any) {
    logger.error("[BYOK] Audit retrieval failed:", error);
    return [];
  }
}
