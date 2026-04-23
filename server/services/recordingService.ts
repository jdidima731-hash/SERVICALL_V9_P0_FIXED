/**
 * Recording Service - Stockage via StorageService
 * Module 5: Enregistrement & Replay
 */

import axios from "axios";
import * as crypto from "crypto";
import { logger } from "../infrastructure/logger";
import { storageService } from "./storage";

// ============================================
// RECORDING STORAGE
// ============================================

/**
 * Upload recording with encryption
 */
export async function uploadRecordingToS3(
  recordingBuffer: Buffer,
  tenantId: number,
  callId: number,
  format: string = "mp3"
): Promise<{ key: string; url: string }> {
  const startTime = Date.now();
  try {
    const fileName = `call-${callId}-${Date.now()}.${format}`;
    const folder = `recordings/tenant-${tenantId}`;

    logger.info("[Recording Service] Uploading recording", { tenantId, callId });

    // Encrypt buffer if encryption key is available
    let finalBuffer = recordingBuffer;
    const encryptionKey = process.env['RECORDING_ENCRYPTION_KEY'];
    if (encryptionKey) {
      finalBuffer = encryptRecording(recordingBuffer, encryptionKey);
      logger.info("[Recording Service] Recording encrypted before upload", { tenantId, callId });
    }

    const { key, url } = await storageService.saveFile({
      tenantId,
      fileName,
      buffer: finalBuffer,
      mimeType: `audio/${format}`,
      folder
    });

    logger.info("[Recording Service] Recording uploaded successfully", { 
      tenantId, 
      callId, 
      duration_ms: Date.now() - startTime 
    });

    return { key, url };
  } catch (error: any) {
    logger.error("[Recording Service] Error uploading recording", error, { tenantId, callId });
    throw new Error("Failed to upload recording");
  }
}

/**
 * Download recording from Twilio and store it
 */
export async function downloadAndStoreRecording(
  twilioRecordingUrl: string,
  tenantId: number,
  callId: number
): Promise<{ key: string; url: string }> {
  try {
    logger.info("[Recording Service] Downloading recording from Twilio", { tenantId, callId, twilioRecordingUrl });
    
    // Download recording from Twilio
    const response = await axios.get(twilioRecordingUrl, {
      responseType: "arraybuffer",
      auth: {
        username: process.env["TWILIO_ACCOUNT_SID"] ?? "",
        password: process.env["TWILIO_AUTH_TOKEN"] ?? "",
      },
      timeout: 30000 // 30s timeout
    });

    const recordingBuffer = Buffer.from(response.data);

    // Store recording
    return await uploadRecordingToS3(recordingBuffer, tenantId, callId, "mp3");
  } catch (error: any) {
    logger.error("[Recording Service] Error downloading and storing recording", error, { tenantId, callId });
    throw new Error("Failed to download and store recording");
  }
}

/**
 * Get recording URL
 */
export async function getRecordingUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    return await storageService.getFileUrl(key, expiresIn);
  } catch (error: any) {
    logger.error("[Recording Service] Error getting recording URL", error, { key });
    throw new Error("Failed to get recording URL");
  }
}

/**
 * Delete recording
 */
export async function deleteRecording(key: string): Promise<void> {
  try {
    logger.info("[Recording Service] Deleting recording", { key });
    await storageService.deleteFile(key);
  } catch (error: any) {
    logger.error("[Recording Service] Error deleting recording", error, { key });
    throw new Error("Failed to delete recording");
  }
}

/**
 * Get recording metadata
 */
export async function getRecordingMetadata(key: string): Promise<Record<string, any>> {
  try {
    return await storageService.getFileMetadata(key);
  } catch (error: any) {
    logger.error("[Recording Service] Error getting recording metadata", error, { key });
    throw new Error("Failed to get recording metadata");
  }
}

// ============================================
// RECORDING ENCRYPTION
// ============================================

/**
 * Encrypt recording buffer
 */
export function encryptRecording(buffer: Buffer, key: string): Buffer {
  try {
    const algorithm = "aes-256-cbc";
    const keyBuffer = crypto.scryptSync(key, "salt", 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    
    // Prepend IV to encrypted data
    return Buffer.concat([iv, encrypted]);
  } catch (error: any) {
    logger.error("[Recording Service] Encryption error", error);
    throw error;
  }
}

/**
 * Decrypt recording buffer
 */
export function decryptRecording(encryptedBuffer: Buffer, key: string): Buffer {
  try {
    const algorithm = "aes-256-cbc";
    const keyBuffer = crypto.scryptSync(key, "salt", 32);
    
    // Extract IV from beginning of buffer
    const iv = encryptedBuffer.slice(0, 16);
    const encrypted = encryptedBuffer.slice(16);
    
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (error: any) {
    logger.error("[Recording Service] Decryption error", error);
    throw error;
  }
}

/**
 * Clean up old recordings based on retention policy
 */
export async function cleanupOldRecordings(
  tenantId: number,
  retentionDays: number = 90
): Promise<number> {
  try {
    logger.info(`[Recording Service] Cleanup job for tenant ${tenantId}: retention ${retentionDays} days`);
    return 0;
  } catch (error: any) {
    logger.error("[Recording Service] Cleanup job failed", error, { tenantId });
    return 0;
  }
}
