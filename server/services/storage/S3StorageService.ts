import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IStorageService } from "./IStorageService";
import { logger } from "../../infrastructure/logger";

export class S3StorageService implements IStorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string;

  constructor() {
    const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
    const region = process.env['AWS_REGION'] || "eu-west-1";
    this.bucketName = process.env['AWS_S3_BUCKET'] || "servicall-recordings";

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      logger.warn("[S3StorageService] Forge credentials missing, service will be unavailable");
    }
  }

  async init(): Promise<void> {
    if (!this.s3Client) {
      logger.warn("[S3StorageService] Not initialized due to missing credentials");
    }
  }

  async saveFile(params: {
    tenantId: number;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
    folder?: string;
  }): Promise<{ key: string; url: string }> {
    if (!this.s3Client) throw new Error("S3StorageService not available");

    const folder = params.folder || `recordings/tenant-${params.tenantId}`;
    const key = `${folder}/${Date.now()}_${params.fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimeType,
    });

    await this.s3Client.send(command);

    const url = await this.getFileUrl(key, 7 * 24 * 60 * 60);
    return { key, url };
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client) throw new Error("S3StorageService not available");

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client) return;

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async getFileMetadata(key: string): Promise<Record<string, any>> {
    if (!this.s3Client) return {};

    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Metadata || {};
  }
}
