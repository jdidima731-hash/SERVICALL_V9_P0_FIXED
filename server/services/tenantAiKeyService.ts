/**
 * TENANT AI KEY SERVICE
 * Gestion sécurisée des clés OpenAI par tenant (BYOK - Bring Your Own Key)
 * Chiffrement/déchiffrement des clés sensibles
 */

import crypto from 'crypto';
import { logger } from "../infrastructure/logger";
import * as db from '../db-industry';
import { ENV } from '../_core/env';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  // const _ENCRYPTION_KEY_LENGTH = 32; // 256 bits

/**
 * Génère une clé de chiffrement à partir d'une clé maître
 */
function getEncryptionKey(): Buffer {
  const masterKey = ENV.encryptionKey;
  if (!masterKey) throw new Error('[tenantAiKeyService] ENCRYPTION_KEY is not set — cannot derive encryption key');
  return crypto
    .createHash('sha256')
    .update(masterKey)
    .digest();
}

/**
 * Chiffre une clé API
 */
export function encryptApiKey(apiKey: string): { encrypted: string; iv: string; authTag: string } {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error: any) {
    logger.error('[TenantAiKeyService] Encryption failed', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Déchiffre une clé API
 */
export function decryptApiKey(encrypted: string, iv: string, authTag: string): string {
  try {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      getEncryptionKey(),
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    logger.error('[TenantAiKeyService] Decryption failed', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Génère un hash SHA-256 de la clé pour validation
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');
}

/**
 * Sauvegarde une clé OpenAI chiffrée pour un tenant
 * ✅ FIX P0: Redirection vers le service BYOK unifié
 */
export async function saveOpenAiKey(tenantId: number, apiKey: string): Promise<boolean> {
  const { saveAPIKey } = await import('./byokService');
  const result = await saveAPIKey(tenantId, 'openai', apiKey);
  return result.success;
}

/**
 * Récupère et déchiffre la clé OpenAI d'un tenant
 * ✅ FIX P0: Redirection vers le service BYOK unifié
 */
export async function getOpenAiKey(tenantId: number): Promise<string | null> {
  const { getAPIKey } = await import('./byokService');
  return await getAPIKey(tenantId, 'openai');
}

/**
 * Valide une clé OpenAI en testant un appel simple
 */
export async function validateOpenAiKey(apiKey: string): Promise<boolean> {
  try {
    // Test simple : appel à la liste des modèles
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      logger.info('[TenantAiKeyService] OpenAI key validation successful');
      return true;
    } else {
      logger.warn('[TenantAiKeyService] OpenAI key validation failed', { status: response.status });
      return false;
    }
  } catch (error: any) {
    logger.error('[TenantAiKeyService] OpenAI key validation error', error);
    return false;
  }
}

/**
 * Supprime la clé OpenAI d'un tenant
 */
export async function deleteOpenAiKey(tenantId: number): Promise<boolean> {
  try {
    await db.deleteTenantAiKey(tenantId, 'openai');
    logger.info('[TenantAiKeyService] OpenAI key deleted for tenant', { tenantId });
    return true;
  } catch (error: any) {
    logger.error('[TenantAiKeyService] Failed to delete OpenAI key', error, { tenantId });
    throw error;
  }
}

/**
 * Vérifie si un tenant a une clé OpenAI configurée
 */
export async function hasOpenAiKey(tenantId: number): Promise<boolean> {
  try {
    const keyRecord = await db.getTenantAiKey(tenantId, 'openai');
    return keyRecord !== null && keyRecord.isActive === true;
  } catch (error: any) {
    logger.error('[TenantAiKeyService] Failed to check OpenAI key', error, { tenantId });
    return false;
  }
}
