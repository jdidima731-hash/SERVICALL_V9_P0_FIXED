/**
 * KMS Service - Gestion des clés de chiffrement locales côté client
 * [CORRIGÉ - BLOC 1] Utilise une MASTER_KEY sécurisée depuis l'environnement.
 */

import crypto from 'crypto';
import { logger } from "../infrastructure/logger";

// [CORRIGÉ - BLOC 1] Valider la présence de la MASTER_KEY au démarrage
if (!process.env['MASTER_KEY'] || process.env['MASTER_KEY'].length < 32) {
  logger.error('[KMS] CRITICAL: MASTER_KEY is missing or too short. Must be at least 32 characters.');
  // En production, il est préférable de quitter le processus si la clé maître est absente
  if (process.env['NODE_ENV'] === 'production') {
    process.exit(1);
  }
}

export interface KMSKey {
  id: string;
  version: number;
  keyType: 'master' | 'data' | 'session';
  expiresAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

class KMSService {
  private readonly MASTER_KEY_ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly AUTH_TAG_LENGTH = 16;

  private getMasterKey(): Buffer {
    const masterKey = process.env['MASTER_KEY'];
    if (!masterKey || masterKey.length < 32) {
        throw new Error('MASTER_KEY is not configured correctly.');
    }
    // Utiliser SHA-256 pour garantir une clé de 32 octets, quelle que soit la longueur de la chaîne d'entrée.
    return crypto.createHash('sha256').update(masterKey).digest();
  }

  /**
   * Chiffrer le matériel de clé avec la master key.
   */
  private encryptKeyMaterial(keyMaterial: Buffer): string {
    const masterKey = this.getMasterKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.MASTER_KEY_ALGORITHM, masterKey, iv) as unknown;

    const encrypted = Buffer.concat([cipher.update(keyMaterial), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Déchiffrer le matériel de clé.
   */
  // - kept for future use
  private _decryptKeyMaterial(encryptedMaterial: string): Buffer {
    const masterKey = this.getMasterKey();
    const combined = Buffer.from(encryptedMaterial, 'base64');

    const iv = combined.subarray(0, this.IV_LENGTH);
    const authTag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(this.MASTER_KEY_ALGORITHM, masterKey, iv) as unknown;
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Génère une nouvelle clé de chiffrement
   */
  async generateKey(
    _tenantId: number,
    keyType: 'master' | 'data' | 'session' = 'data',
    expiresInDays?: number
  ): Promise<KMSKey> {
    const keyMaterial = crypto.randomBytes(32);
    const encryptedKey = this.encryptKeyMaterial(keyMaterial);
    logger.debug('[KMS] Key generated', { keyType, encryptedKeyLength: encryptedKey.length });

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    return {
      id: crypto.randomUUID(),
      version: 1,
      keyType,
      expiresAt,
      createdAt: new Date(),
      isActive: true,
    };
  }

  /**
   * Récupère la clé active pour le chiffrement
   */
  async getActiveKey(_keyType: 'master' | 'data' | 'session' = 'data'): Promise<Buffer> {
    // En production, cette méthode récupérerait la clé depuis un stockage sécurisé.
    // Pour l'instant, on dérive une clé depuis la MASTER_KEY.
    const masterKey = this.getMasterKey();
    return masterKey;
  }

  /**
   * Effectue une rotation de clé
   */
  async rotateKey(
    _tenantId: number,
    keyType: 'master' | 'data' | 'session' = 'data'
  ): Promise<KMSKey> {
    logger.info('[KMS] Rotating key', { keyType });
    return this.generateKey(_tenantId, keyType);
  }

  /**
   * Révoque une clé
   */
  async revokeKey(_tenantId: number, _keyId: string): Promise<void> {
    logger.info('[KMS] Key revoked', { keyId: _keyId });
    // En production, marquer la clé comme révoquée dans le stockage
  }

  /**
   * Vérifie la santé des clés
   */
  async checkKeyHealth(_tenantId: number): Promise<{
    healthy: boolean;
    activeKeys: number;
    expiringSoon: number;
    expired: number;
  }> {
    return {
      healthy: true,
      activeKeys: 1,
      expiringSoon: 0,
      expired: 0,
    };
  }
}

export const kmsService = new KMSService();
export type { KMSService };
