import { router } from "../_core/trpc";
import { agentProcedure, tenantProcedure } from "../procedures";
import { z } from "zod";
import { FileService } from "../services/fileService";
import { analyzeDocument } from "../services/aiService";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { documents } from "../../drizzle/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { paginationInput, paginate } from "../_core/pagination";
import { logger } from "../infrastructure/logger";


export const documentRouter = router({
  /**
   * Uploader un document (Photo ou Scan)
   */
  upload: agentProcedure
    .input(z.object({
      fileName: z.string(),
      base64Data: z.string(), // Format: data:image/jpeg;base64,...
      type: z.enum(["photo", "scan", "contract", "id_card", "other"]),
      prospectId: z.number().optional(),
      propertyId: z.number().optional(),
      runOCR: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      try {
        // Extraire le buffer du base64
        const base64Content = input.base64Data.split(",")[1] ?? input.base64Data;
        const buffer = Buffer.from(base64Content, "base64");
        const mimeType = input.base64Data.split(";")[0]?.split(":")[1] ?? 'application/octet-stream';

        // Sauvegarder le fichier
        const fileInfo = await FileService.saveFile({
          tenantId: ctx.tenantId!,
          fileName: input.fileName,
          buffer,
          mimeType,
          type: input.type,
          prospectId: input.prospectId,
          // propertyId does not exist in documents schema - removed
        });

        let ocrData = null;
        if (input.runOCR) {
          ocrData = await analyzeDocument({ content: base64Content, type: input.type });
          
          // Mettre à jour le document avec les données OCR
          const dbInstance = db.getDbInstance();
          if (dbInstance) {
            await dbInstance.update(documents)
              .set({ ocrData: JSON.stringify(ocrData) })
              .where(eq(documents.id, fileInfo.id));
          }
        }

        return {
          success: true,
          documentId: fileInfo.id,
          fileUrl: fileInfo.fileUrl,
          ocrData,
        };
      } catch (error: any) {
        logger.error("[Document Router] Upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de l'upload du document",
        });
      }
    }),

  /**
   * Lister les documents d'un prospect ou d'un bien
   */
  list: tenantProcedure
    .input(paginationInput.extend({
      prospectId: z.number().optional(),
      propertyId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { page, limit } = input;
      const offset = (page - 1) * limit;
      const dbInstance = db.getDbInstance();
      if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(documents.tenantId, ctx.tenantId!)];
      if (input.prospectId) conditions.push(eq(documents.prospectId, input.prospectId));
      // propertyId does not exist in documents schema - removed
      // if (input.propertyId) conditions.push(eq(documents.propertyId, input.propertyId));

      const [data, totalResult] = await Promise.all([
        dbInstance.select().from(documents)
          .where(and(...conditions))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(documents.createdAt)),
        dbInstance.select({ value: count() })
          .from(documents)
          .where(and(...conditions))
      ]);

      return paginate(data, totalResult[0]?.value ?? 0, input);
    }),
});
