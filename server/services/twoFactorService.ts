/**
 * Two-Factor Authentication (2FA) Service
 * Implements TOTP-based 2FA with Google Authenticator compatibility
 */

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { logger } from "../infrastructure/logger";
import { db } from "../db";
import { user2FA } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Generate a new 2FA secret and QR code for a user
 */
export async function generate2FASecret(
  userId: number,
  userEmail: string
): Promise<TwoFactorSetup> {
  try {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Servicall (${userEmail})`,
      issuer: "Servicall CRM",
      length: 32,
    });

    if (!secret.otpauth_url) {
      throw new Error("Failed to generate OTP auth URL");
    }

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Generate 10 backup codes (8 characters each)
    const backupCodes = Array.from({ length: 10 }, () =>
      randomBytes(4).toString("hex").toUpperCase()
    );

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10))
    );

    // Store in database (disabled by default until user verifies)
    await db.insert(user2FA).values({
      userId,
      secret: secret.base32,
      isEnabled: false,
      backupCodes: JSON.stringify(hashedBackupCodes),
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: user2FA.userId,
      set: {
        secret: secret.base32,
        backupCodes: JSON.stringify(hashedBackupCodes),
        updatedAt: new Date(),
      },
    });

    logger.info("[2FA] Secret generated for user", { userId });

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  } catch (error: any) {
    logger.error("[2FA] Failed to generate secret", { error, userId });
    throw error;
  }
}

/**
 * Verify a TOTP code
 */
export async function verify2FACode(
  userId: number,
  token: string
): Promise<boolean> {
  try {
    // Get user's 2FA secret
    const user2FARecord = await db.query.user2FA.findFirst({
      where: eq(user2FA.userId, userId),
    });

    if (!user2FARecord || !user2FARecord.secret) {
      logger.warn("[2FA] No 2FA secret found for user", { userId });
      return false;
    }

    // Verify TOTP code (with ±2 time windows = 60 seconds tolerance)
    const verified = speakeasy.totp.verify({
      secret: user2FARecord.secret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (verified) {
      logger.info("[2FA] Code verified successfully", { userId });
    } else {
      logger.warn("[2FA] Invalid code provided", { userId });
    }

    return verified;
  } catch (error: any) {
    logger.error("[2FA] Failed to verify code", { error, userId });
    return false;
  }
}

/**
 * Verify a backup code
 */
export async function verifyBackupCode(
  userId: number,
  backupCode: string
): Promise<boolean> {
  try {
    // Get user's 2FA record
    const user2FARecord = await db.query.user2FA.findFirst({
      where: eq(user2FA.userId, userId),
    });

    if (!user2FARecord || !user2FARecord.backupCodes) {
      logger.warn("[2FA] No backup codes found for user", { userId });
      return false;
    }

    const hashedBackupCodes = JSON.parse(user2FARecord.backupCodes as string) as string[];

    // Check each backup code
    for (let i = 0; i < hashedBackupCodes.length; i++) {
      const isMatch = await bcrypt.compare(backupCode, hashedBackupCodes[i] ?? '');
      if (isMatch) {
        // Remove used backup code
        hashedBackupCodes.splice(i, 1);
        await db
          .update(user2FA)
          .set({
            backupCodes: JSON.stringify(hashedBackupCodes),
            updatedAt: new Date(),
          })
          .where(eq(user2FA.userId, userId));

        logger.info("[2FA] Backup code used successfully", {
          userId,
          remainingCodes: hashedBackupCodes.length,
        });
        return true;
      }
    }

    logger.warn("[2FA] Invalid backup code provided", { userId });
    return false;
  } catch (error: any) {
    logger.error("[2FA] Failed to verify backup code", { error, userId });
    return false;
  }
}

/**
 * Enable 2FA for a user (after verification)
 */
export async function enable2FA(userId: number, token: string): Promise<boolean> {
  try {
    // Verify the token first
    const verified = await verify2FACode(userId, token);
    if (!verified) {
      logger.warn("[2FA] Cannot enable 2FA - invalid token", { userId });
      return false;
    }

    // Enable 2FA
    await db
      .update(user2FA)
      .set({
        isEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(user2FA.userId, userId));

    logger.info("[2FA] 2FA enabled for user", { userId });
    return true;
  } catch (error: any) {
    logger.error("[2FA] Failed to enable 2FA", { error, userId });
    return false;
  }
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: number): Promise<boolean> {
  try {
    await db
      .update(user2FA)
      .set({
        isEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(user2FA.userId, userId));

    logger.info("[2FA] 2FA disabled for user", { userId });
    return true;
  } catch (error: any) {
    logger.error("[2FA] Failed to disable 2FA", { error, userId });
    return false;
  }
}

/**
 * Check if 2FA is enabled for a user
 */
export async function is2FAEnabled(userId: number): Promise<boolean> {
  try {
    const user2FARecord = await db.query.user2FA.findFirst({
      where: eq(user2FA.userId, userId),
    });

    return user2FARecord?.isEnabled ?? false;
  } catch (error: any) {
    logger.error("[2FA] Failed to check 2FA status", { error, userId });
    return false;
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  try {
    // Generate new backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      randomBytes(4).toString("hex").toUpperCase()
    );

    // Hash backup codes
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10))
    );

    // Update in database
    await db
      .update(user2FA)
      .set({
        backupCodes: JSON.stringify(hashedBackupCodes),
        updatedAt: new Date(),
      })
      .where(eq(user2FA.userId, userId));

    logger.info("[2FA] Backup codes regenerated", { userId });
    return backupCodes;
  } catch (error: any) {
    logger.error("[2FA] Failed to regenerate backup codes", { error, userId });
    throw error;
  }
}

/**
 * Get 2FA status for a user
 */
export async function get2FAStatus(userId: number): Promise<{
  enabled: boolean;
  hasSecret: boolean;
  backupCodesCount: number;
}> {
  try {
    const user2FARecord = await db.query.user2FA.findFirst({
      where: eq(user2FA.userId, userId),
    });

    if (!user2FARecord) {
      return {
        enabled: false,
        hasSecret: false,
        backupCodesCount: 0,
      };
    }

    const backupCodes = user2FARecord.backupCodes
      ? (JSON.parse(user2FARecord.backupCodes as string) as string[])
      : [];

    return {
      
      enabled: user2FARecord.isEnabled,
      hasSecret: !!user2FARecord.secret,
      backupCodesCount: backupCodes.length,
    };
  } catch (error: any) {
    logger.error("[2FA] Failed to get 2FA status", { error, userId });
    return {
      enabled: false,
      hasSecret: false,
      backupCodesCount: 0,
    };
  }
}