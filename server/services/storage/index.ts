import { IStorageService } from "./IStorageService";
import { LocalStorageService } from "./LocalStorageService";
import { S3StorageService } from "./S3StorageService";
import { logger } from "../../infrastructure/logger";

/**
 * Storage Factory - Gère l'instanciation du service de stockage
 */
class StorageFactory {
  private static instance: IStorageService;

  static getInstance(): IStorageService {
    if (!this.instance) {
      const hasAwsCredentials = !!process.env['AWS_ACCESS_KEY_ID'] && !!process.env['AWS_SECRET_ACCESS_KEY'];
      const forceS3 = process.env['STORAGE_TYPE'] === "s3";

      if (forceS3 || hasAwsCredentials) {
        logger.info("[StorageFactory] Using S3StorageService");
        this.instance = new S3StorageService();
      } else {
        logger.info("[StorageFactory] Using LocalStorageService (fallback)");
        this.instance = new LocalStorageService();
      }
    }
    return this.instance;
  }
}

export const storageService = StorageFactory.getInstance();
export * from "./IStorageService";
export * from "./LocalStorageService";
export * from "./S3StorageService";
