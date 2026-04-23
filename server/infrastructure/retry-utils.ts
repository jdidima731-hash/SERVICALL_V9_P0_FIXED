/**
 * retry-utils.ts
 * ✅ R5: executeWithRetry<T> générique — Promise<T> au lieu de Promise<any>
 */
import { logger } from "./logger";

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  label = "operation"
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt === maxRetries - 1) break;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      logger.warn(`[${label}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise<void>(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
