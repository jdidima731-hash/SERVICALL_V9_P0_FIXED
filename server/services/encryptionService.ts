/**
 * Encryption Service - Chiffrement des données sensibles
 * Chiffre DB, S3 et flux en transit (AES/RSA selon besoin)
 */

import crypto from 'crypto';
import { kmsService } from './kmsService';
import { logger as loggingService } from "../infrastructure/logger";
import { AuditService } from './auditService';


interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyVersion: number;
}

interface EncryptionOptions {
  tenantId: number;
  dataType: 'transcription' | 'scoring' | 'notes' | 'crm' | 'recording' | 'personal';
  userId?: number;
}

class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
// - kept for documentation
  private readonly _AUTH_TAG_LENGTH = 16;

  /**
   * Chiffre des données sensibles
   */
  async encrypt(plaintext: string, options: EncryptionOptions): Promise<EncryptedData> {
    try {
      const { tenantId, dataType, userId } = options;

      // Récupérer la clé de chiffrement active pour ce tenant
      // [CORRIGÉ - BLOC 1] Utilisation de la nouvelle logique KMS
      const key = await kmsService.getActiveKey('data');

      // Générer un IV aléatoire
      const iv = crypto.randomBytes(this.IV_LENGTH);

      // Créer le cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      // Chiffrer les données
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);

      // Récupérer l'auth tag pour l'authentification
      const authTag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: this.ALGORITHM,
        keyVersion: 1 // À récupérer depuis KMS
      };

      // Audit log pour données sensibles
      if (['transcription', 'recording', 'personal'].includes(dataType)) {
        await AuditService.log({
          tenantId,
          action: 'DATA_ANONYMIZE',
          resource: dataType,
          resourceId: crypto.randomUUID(),
          metadata: { algorithm: this.ALGORITHM, dataLength: plaintext.length },
          userId: userId ?? 0,
          actorType: 'system',
          source: 'SYSTEM',
        });
      }

      loggingService.debug('Encryption: Données chiffrées', {
        tenantId,
        dataType,
        originalLength: plaintext.length,
        encryptedLength: encrypted.length
      });

      return encryptedData;
    } catch (error: any) {
      loggingService.error('Encryption: Erreur lors du chiffrement', {
        error,
        tenantId: options.tenantId
      });
      throw new Error('Impossible de chiffrer les données');
    }
  }

  /**
   * Déchiffre des données
   */
  async decrypt(encryptedData: EncryptedData, options: EncryptionOptions): Promise<string> {
    try {
      const { tenantId, dataType, userId } = options;

      // Récupérer la clé correspondante (en fonction de la version)
      // [CORRIGÉ - BLOC 1] Utilisation de la nouvelle logique KMS
      const key = await kmsService.getActiveKey('data');

      // Convertir depuis base64
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');

      // Créer le decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Déchiffrer
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      // Audit log pour données sensibles
      if (['transcription', 'recording', 'personal'].includes(dataType)) {
        await AuditService.log({
          tenantId,
          action: 'DATA_EXPORT',
          resource: dataType,
          resourceId: crypto.randomUUID(),
          metadata: { algorithm: encryptedData.algorithm },
          userId: userId ?? 0,
          actorType: 'system',
          source: 'SYSTEM',
        });
      }

      loggingService.debug('Encryption: Données déchiffrées', {
        tenantId,
        dataType
      });

      return decrypted.toString('utf8');
    } catch (error: any) {
      loggingService.error('Encryption: Erreur lors du déchiffrement', {
        error,
        tenantId: options.tenantId
      });
      throw new Error('Impossible de déchiffrer les données');
    }
  }

  /**
   * Chiffre un objet JSON complet
   */
  async encryptObject<T>(obj: T, options: EncryptionOptions): Promise<EncryptedData> {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString, options);
  }

  /**
   * Déchiffre un objet JSON
   */
  async decryptObject<T>(encryptedData: EncryptedData, options: EncryptionOptions): Promise<T> {
    const jsonString = await this.decrypt(encryptedData, options);
    return JSON.parse(jsonString) as T;
  }

  /**
   * Chiffre un champ spécifique dans un objet
   */
  async encryptField(
    obj: Record<string, any>,
    fieldName: string,
    options: EncryptionOptions
  ): Promise<Record<string, any>> {
    if (obj[fieldName] === undefined || obj[fieldName] === null) {
      return obj;
    }

    const fieldValue = typeof obj[fieldName] === 'string' 
      ? obj[fieldName] 
      : JSON.stringify(obj[fieldName]);

    const encrypted = await this.encrypt(fieldValue, options);

    return {
      ...obj,
      [fieldName]: encrypted,
      [`${fieldName}_encrypted`]: true
    };
  }

  /**
   * Déchiffre un champ spécifique dans un objet
   */
  async decryptField(
    obj: Record<string, any>,
    fieldName: string,
    options: EncryptionOptions
  ): Promise<Record<string, any>> {
    if (!obj[`${fieldName}_encrypted`]) {
      return obj;
    }

    const decrypted = await this.decrypt(obj[fieldName] as EncryptedData, options);

    // Essayer de parser en JSON si possible
    let value: any;
    try {
      value = JSON.parse(decrypted);
    } catch {
      value = decrypted;
    }

    const result = { ...obj };
    result[fieldName] = value;
    delete result[`${fieldName}_encrypted`];

    return result;
  }

  /**
   * Chiffre plusieurs champs dans un objet
   */
  async encryptFields(
    obj: Record<string, any>,
    fieldNames: string[],
    options: EncryptionOptions
  ): Promise<Record<string, any>> {
    let result = { ...obj };

    for (const fieldName of fieldNames) {
      result = await this.encryptField(result, fieldName, options);
    }

    return result;
  }

  /**
   * Déchiffre plusieurs champs dans un objet
   */
  async decryptFields(
    obj: Record<string, any>,
    fieldNames: string[],
    options: EncryptionOptions
  ): Promise<Record<string, any>> {
    let result = { ...obj };

    for (const fieldName of fieldNames) {
      result = await this.decryptField(result, fieldName, options);
    }

    return result;
  }

  /**
   * Hash sécurisé pour recherche (permet recherche sans déchiffrement)
   */
  async createSearchableHash(value: string, _tenantId: number): Promise<string> {
    // [CORRIGÉ - BLOC 1] Utilisation de la nouvelle logique KMS
    const key = await kmsService.getActiveKey('data');
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(value);
    return hmac.digest('hex');
  }

  /**
   * Anonymise des données (pour conformité GDPR)
   */
  anonymize(value: string, type: 'email' | 'phone' | 'name' | 'text'): string {
    switch (type) {
      case 'email':
        const [localPart, domain] = value.split('@');
        return `${localPart!.substring(0, 2)}***@${domain}`;
      
      case 'phone':
        return value.replace(/\d(?=\d{4})/g, '*');
      
      case 'name':
        const parts = value.split(' ');
        return parts.map((p: any) => p.charAt(0) + '*'.repeat(p.length - 1)).join(' ');
      
      case 'text':
        return '[ANONYMISÉ]';
      
      default:
        return '[ANONYMISÉ]';
    }
  }

  /**
   * Chiffre un fichier (pour S3)
   */
  async encryptFile(fileBuffer: Buffer, options: EncryptionOptions): Promise<{
    encryptedBuffer: Buffer;
    metadata: EncryptedData;
  }> {
    try {
      const { tenantId } = options;
      // [CORRIGÉ - BLOC 1] Utilisation de la nouvelle logique KMS
      const key = await kmsService.getActiveKey('data');
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const metadata: EncryptedData = {
        ciphertext: '', // Non utilisé pour les fichiers
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: this.ALGORITHM,
        keyVersion: 1
      };

      loggingService.debug('Encryption: Fichier chiffré', {
        tenantId,
        originalSize: fileBuffer.length,
        encryptedSize: encrypted.length
      });

      return {
        encryptedBuffer: encrypted,
        metadata
      };
    } catch (error: any) {
      loggingService.error('Encryption: Erreur lors du chiffrement de fichier', {
        error,
        tenantId: options.tenantId
      });
      throw new Error('Impossible de chiffrer le fichier');
    }
  }

  /**
   * Déchiffre un fichier
   */
  async decryptFile(
    encryptedBuffer: Buffer,
    metadata: EncryptedData,
    options: EncryptionOptions
  ): Promise<Buffer> {
    try {
      const { tenantId } = options;
      // [CORRIGÉ - BLOC 1] Utilisation de la nouvelle logique KMS
      const key = await kmsService.getActiveKey('data');

      const iv = Buffer.from(metadata.iv, 'base64');
      const authTag = Buffer.from(metadata.authTag, 'base64');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

      loggingService.debug('Encryption: Fichier déchiffré', {
        tenantId,
        encryptedSize: encryptedBuffer.length,
        decryptedSize: decrypted.length
      });

      return decrypted;
    } catch (error: any) {
      loggingService.error('Encryption: Erreur lors du déchiffrement de fichier', {
        error,
        tenantId: options.tenantId
      });
      throw new Error('Impossible de déchiffrer le fichier');
    }
  }

  /**
   * Chiffrement en transit (TLS/SSL) - Validation
   */
  validateTransitEncryption(protocol: string, cipherSuite: string): boolean {
    const allowedProtocols = ['TLSv1.2', 'TLSv1.3'];
    const allowedCiphers = [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256'
    ];

    const isProtocolValid = allowedProtocols.includes(protocol);
    const isCipherValid = allowedCiphers.some(cipher => cipherSuite.includes(cipher));

    if (!isProtocolValid || !isCipherValid) {
      loggingService.warn('Encryption: Protocole ou cipher non sécurisé détecté', {
        protocol,
        cipherSuite
      });
    }

    return isProtocolValid && isCipherValid;
  }
}

export const encryptionService = new EncryptionService();
