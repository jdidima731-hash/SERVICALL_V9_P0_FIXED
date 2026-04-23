import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { documents } from "../../drizzle/schema";
import { storageService } from "./storage";
import { eq, and } from "drizzle-orm";

/**
 * File Service - Gestion du stockage via StorageService (S3 ou local)
 */
export class FileService {
  /**
   * Initialiser les répertoires de stockage
   */
  static async init() {
    await storageService.init();
  }

  /**
   * Sauvegarder un fichier pour un tenant spécifique
   */
  static async saveFile(params: {
    tenantId: number;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    type: "photo" | "scan" | "contract" | "id_card" | "other";
    prospectId?: number;
    propertyId?: number;
  }) {
    try {
      // ✅ AXE 3: Utilisation du storageService (S3 si configuré)
      const { key, url } = await storageService.saveFile({
        tenantId: params.tenantId,
        fileName: params.fileName,
        buffer: params.buffer,
        mimeType: params.mimeType,
        folder: `documents/tenant-${params.tenantId}/${params.type}`
      });

      // Enregistrer en base de données
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      
      const [newDoc] = await db.insert(documents).values({
        tenantId: params.tenantId,
        prospectId: params.prospectId,
        propertyId: params.propertyId,
        name: params.fileName,
        type: params.type,
        url: url, // ✅ Utilise le champ 'url' du schéma
        storageKey: key, // ✅ Utilise le champ 'storageKey' du schéma
        mimeType: params.mimeType,
        size: params.buffer.length,
      }).returning();

      logger.info(`[FileService] File saved: ${url} for tenant ${params.tenantId}`);
      return { id: newDoc.id, fileUrl: url, key };
    } catch (error: any) {
      logger.error("[FileService] Error saving file", error);
      throw error;
    }
  }

  /**
   * Supprimer un fichier
   */
  static async deleteFile(docId: number, tenantId: number) {
    try {
      const db = getDbInstance();
      if (!db) return;

      // 1. Récupérer la clé de stockage
      const docs = await db.select()
        .from(documents)
        .where(and(eq(documents.id, docId), eq(documents.tenantId, tenantId)))
        .limit(1);

      const doc = docs[0];
      if (!doc || !doc.storageKey) {
        logger.warn(`[FileService] Document ${docId} not found or no storage key`);
        return;
      }

      // 2. Supprimer du stockage physique (S3 ou Local)
      await storageService.deleteFile(doc.storageKey);

      // 3. Supprimer de la base de données
      await db.delete(documents).where(eq(documents.id, docId));

      logger.info(`[FileService] File deleted: ${doc.storageKey} (docId: ${docId})`);
    } catch (error: any) {
      logger.error("[FileService] Error deleting file", error);
    }
  }

  /**
   * Obtenir une URL signée (si S3)
   */
  static async getDownloadUrl(docId: number, tenantId: number, expiresIn = 3600) {
    const db = getDbInstance();
    if (!db) throw new Error("Database not available");

    const docs = await db.select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.tenantId, tenantId)))
      .limit(1);

    const doc = docs[0];
    if (!doc || !doc.storageKey) throw new Error("Document not found");

    return await storageService.getFileUrl(doc.storageKey, expiresIn);
  }
}