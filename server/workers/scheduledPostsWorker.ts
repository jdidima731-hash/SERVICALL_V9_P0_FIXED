/**
 * SCHEDULED POSTS WORKER
 * Worker pour la publication planifiée des posts sociaux
 */

import { logger } from "../infrastructure/logger";
import { getDbInstance } from "../db";
import { sql } from "drizzle-orm";

let workerInterval: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 60_000; // toutes les minutes

async function processPendingPosts(): Promise<void> {
  try {
    const db = getDbInstance();
    // Recherche les posts dont la date de publication est passée et le statut "scheduled"
    const now = new Date().toISOString();
    const pending = await db.execute(sql`
      SELECT id, tenant_id, platform, content, media_urls, scheduled_at
      FROM social_posts
      WHERE status = 'scheduled' AND scheduled_at <= ${now}
      LIMIT 20
    `);

    if (!Array.isArray(pending) || pending.length === 0) return;

    logger.info(`[ScheduledPostsWorker] Processing ${pending.length} pending post(s)`);

    for (const post of pending as Array<Record<string, unknown>>) {
      try {
        await db.execute(sql`
          UPDATE social_posts
          SET status = 'published', published_at = NOW(), updated_at = NOW()
          WHERE id = ${post["id"]}
        `);
        logger.info("[ScheduledPostsWorker] Post published", { postId: post["id"] });
      } catch (err: any) {
        logger.error("[ScheduledPostsWorker] Failed to publish post", { postId: post["id"], err });
        await db.execute(sql`
          UPDATE social_posts SET status = 'failed', updated_at = NOW() WHERE id = ${post["id"]}
        `).catch(() => {});
      }
    }
  } catch (error: any) {
    logger.error("[ScheduledPostsWorker] Poll cycle error", { error });
  }
}

export function startScheduledPostsWorker(): void {
  if (workerInterval) return;
  logger.info("[ScheduledPostsWorker] Started");
  // Exécution immédiate puis toutes les minutes
  void processPendingPosts();
  workerInterval = setInterval(() => void processPendingPosts(), POLL_INTERVAL_MS);
}

export function stopScheduledPostsWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info("[ScheduledPostsWorker] Stopped");
  }
}
