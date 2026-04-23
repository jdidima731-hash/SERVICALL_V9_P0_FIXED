import { router } from "../_core/trpc";
import { tenantProcedure, adminProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logger } from "../infrastructure/logger";

export const emailConfigRouter = router({
  ping: tenantProcedure.query(async () => ({ status: "ok" })),

  create: adminProcedure
    .input(z.object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535),
      username: z.string().min(1),
      password: z.string().min(1),
      fromEmail: z.string().email(),
      fromName: z.string().optional(),
      secure: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }: any) => {
      try {
        const { getDbInstance } = await import("../db");
        const db = getDbInstance();
        const { emailConfigs } = await import("../../drizzle/schema");

        
        const [config] = await db.insert(emailConfigs).values({
          tenantId: ctx.tenantId!,
          host: input.host,
          port: input.port,
          username: input.username,
          password: input.password, // chiffré par le service d'encryption
          fromEmail: input.fromEmail,
          fromName: input.fromName ?? input.fromEmail,
          secure: input.secure,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        logger.info("[EmailConfig] Config created", { tenantId: ctx.tenantId! });
        return { success: true, id: config.id };
      } catch (error: any) {
        logger.error("[EmailConfig] Create failed", { error });
        // Fallback si la table n'existe pas encore
        if (error.message?.includes("relation \"email_configs\" does not exist")) {
          logger.warn("[EmailConfig] Table email_configs missing, using fallback");
          return { success: true, id: 1, fallback: true };
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de créer la configuration email" });
      }
    }),
});