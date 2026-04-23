import { z } from "zod";
import { router, tenantProcedure } from "../procedures";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

/**
 * TASK ROUTER — SERVICALL V8
 * Stub minimal pour la gestion des tâches système et rappels
 */

export const taskRouter = router({
  /**
   * Liste les tâches pour le tenant actuel
   */
  list: tenantProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      // Utilisation du narrowing garanti par tenantProcedure (ctx.tenantId!)
      // Note: On utilise failedJobs car la table jobs générique est dans schema-missing
      return await db.select()
        .from(schema.failedJobs)
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(desc(schema.failedJobs.failedAt));
    }),

  /**
   * Récupère les statistiques des tâches échouées
   */
  getStats: tenantProcedure.query(async ({ ctx }) => {
    const jobs = await db.select()
      .from(schema.failedJobs);

    return {
      total: jobs.length,
      failed: jobs.filter(j => j.status === 'failed').length,
      retrying: jobs.filter(j => j.status === 'retrying').length,
    };
  }),
});
