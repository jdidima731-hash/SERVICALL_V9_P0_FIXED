import fs from "fs/promises";
import path from "path";
import { IStorageService } from "./IStorageService";
import { logger } from "../../infrastructure/logger";
import { ENV } from "../../_core/env";

export class LocalStorageService implements IStorageService {
  private storageRoot: string;
  private baseUrl: string;

  constructor() {
    this.storageRoot = path.join(process.cwd(), "uploads");
    this.baseUrl = ENV.appUrl || "http://localhost:3000";
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.storageRoot, { recursive: true });
      logger.info(`[LocalStorageService] Storage initialized at ${this.storageRoot}`);
    } catch (error: any) {
      logger.error("[LocalStorageService] Failed to init storage", error);
    }
  }

  async saveFile(params: {
    tenantId: number;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    folder?: string;
  }): Promise<{ key: string; url: string }> {
    const folderPath = params.folder || `tenant_${params.tenantId}`;
    const targetDir = path.join(this.storageRoot, folderPath);
    await fs.mkdir(targetDir, { recursive: true });

    const fileExt = path.extname(params.fileName);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExt}`;
    const filePath = path.join(targetDir, uniqueName);
    const key = path.join(folderPath, uniqueName);

    await fs.writeFile(filePath, params.buffer);

    const url = `${this.baseUrl}/api/files/${key.replace(/\\/g, "/")}`;
    
    logger.info(`[LocalStorageService] File saved: ${key}`);
    return { key, url };
  }

  async getFileUrl(key: string): Promise<string> {
    return `${this.baseUrl}/api/files/${key.replace(/\\/g, "/")}`;
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.storageRoot, key);
      await fs.unlink(filePath);
      logger.info(`[LocalStorageService] File deleted: ${key}`);
    } catch (error: any) {
      logger.error(`[LocalStorageService] Error deleting file: ${key}`, error);
    }
  }

  async getFileMetadata(key: string): Promise<Record<string, any>> {
    try {
      const filePath = path.join(this.storageRoot, key);
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    } catch (error: any) {
      logger.error(`[LocalStorageService] Error getting metadata: ${key}`, error);
      return {};
    }
  }
}
