import fs from "fs";
import { fileURLToPath } from "url";
import { logger } from "../core/logger/index";

void fileURLToPath(import.meta.url);

function ensureEmptyFile(filePath: string): void {
  fs.writeFileSync(filePath, "", { encoding: "utf8" });
}

async function resetDb(): Promise<void> {
  const dbPath = process.env["DATABASE_URL"] || "servicall.db";
  logger.info(`🧹 Resetting database: ${dbPath}`);

  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      logger.info("✅ Existing database file deleted.");
    }

    ensureEmptyFile(dbPath);
    logger.info("✅ New empty database file created.");
    process.exit(0);
  } catch (error: unknown) {
    logger.error("❌ Failed to reset database", { error });
    process.exit(1);
  }
}

void resetDb();
