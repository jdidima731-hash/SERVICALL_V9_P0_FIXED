/**
 * BLOC 4 - Industry Router
 * Gère le catalogue des métiers et des configurations par défaut
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { publicProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import { TRPCError } from "@trpc/server";
import * as fs from "fs/promises";
import * as path from "path";

export const industryRouter = router({
  /**
   * Récupère le catalogue complet des industries
   * BLOC 4: Lecture sécurisée du JSON, fallback sur objet vide
   */
  getCatalog: publicProcedure.query(async () => {
    const startTime = Date.now();
    try {
      const catalogPath = path.join(process.cwd(), "INDUSTRIES_CATALOG.json");
      const content = await fs.readFile(catalogPath, "utf-8");
      const catalog = JSON.parse(content);

      logger.info("[Industry Router] Catalog retrieved", {
        duration: Date.now() - startTime,
      });

      return catalog;
    } catch (error: any) {
      logger.error("[Industry Router] Failed to load catalog", {
        error: error instanceof Error ? error.message : String(error),
      });

      // BLOC 4: Fallback UI - évite le crash si le fichier est manquant ou corrompu
      return {
        industries: {},
        capabilities: {}
      };
    }
  }),

  /**
   * Récupère une industrie spécifique par son ID
   */
  getById: publicProcedure
    .input(z.string())
    .query(async ({ input }: any) => {
      try {
        const catalogPath = path.join(process.cwd(), "INDUSTRIES_CATALOG.json");
        const content = await fs.readFile(catalogPath, "utf-8");
        const catalog = JSON.parse(content);
        
        const industry = catalog.industries[input];
        if (!industry) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Métier '${input}' non trouvé dans le catalogue`,
          });
        }
        
        return industry;
      } catch (error: any) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération du métier",
        });
      }
    }),
});
