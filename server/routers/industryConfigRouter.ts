/**
 * INDUSTRY CONFIG ROUTER
 * Endpoints tRPC pour la gestion de la configuration métier et des clés OpenAI
 */

import { router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import * as tenantIndustryService from "../services/tenantIndustryService";
import * as tenantAiKeyService from "../services/tenantAiKeyService";
import { AuditService } from "../services/auditService";

export const industryConfigRouter = router({
  /**
   * Récupère le catalogue complet des métiers
   * ✅ CORRECTION: Utilise tenantProcedure car le catalogue est global
   */
  getCatalog: tenantProcedure.query(async () => {
    try {
      const industries = tenantIndustryService.getIndustriesCatalog();
      return {
        success: true,
        data: { industries },
      };
    } catch (error: any) {
      logger.error("[Industry Config Router] Error getting catalog", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer le catalogue des métiers",
      });
    }
  }),

  /**
   * Récupère les métiers groupés par catégorie
   * ✅ CORRECTION: Utilise tenantProcedure car les métiers sont globaux
   */
  getIndustriesByCategory: tenantProcedure.query(async () => {
    try {
      const industries = tenantIndustryService.getIndustriesByCategory();
      return {
        success: true,
        data: industries,
      };
    } catch (error: any) {
      logger.error("[Industry Config Router] Error getting industries by category", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer les métiers",
      });
    }
  }),

  /**
   * Récupère les détails d'un métier spécifique
   * ✅ CORRECTION: Utilise tenantProcedure car les détails sont globaux
   */
  getIndustryDetails: tenantProcedure
    .input(z.object({ industryId: z.string() }))
    .query(async ({ input }: any) => {
      try {
        const industry = tenantIndustryService.getIndustryDetails(input.industryId);
        return {
          success: true,
          data: industry,
        };
      } catch (error: any) {
        logger.error("[Industry Config Router] Error getting industry details", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Métier non trouvé",
        });
      }
    }),

  /**
   * Récupère la configuration métier du tenant actuel
   * ✅ CORRECTION: Utilise tenantProcedure et récupère tenantId du contexte
   */
  getCurrentConfig: tenantProcedure.query(async ({ ctx }) => {
    try {
      // ✅ BLOC 1: Récupérer le tenantId depuis le contexte (validation stricte)
      const tenantId = ctx.tenantId!;
      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Accès refusé : aucun tenant associé à votre session",
        });
      }
      const config = await tenantIndustryService.getTenantIndustryConfig(tenantId);
      return {
        success: true,
        data: config,
      };
    } catch (error: any) {
      logger.error("[Industry Config Router] Error getting current config", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de récupérer la configuration",
      });
    }
  }),

  /**
   * Définit la configuration métier du tenant
   * ✅ CORRECTION: Utilise tenantProcedure avec input tenantId optionnel
   */
  setConfig: tenantProcedure
    .input(
      z.object({
        industryId: z.string(),
        enabledCapabilities: z.array(z.string()).optional(),
        enabledWorkflows: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Accès refusé : aucun tenant associé à votre session",
          });
        }
        
        // Vérifier les permissions (manager ou admin)
        const userRole = ctx.user!.role;
        if (!['admin', 'manager', 'superadmin'].includes(userRole)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès réservé aux managers et administrateurs",
          });
        }
        
        const config = await tenantIndustryService.setTenantIndustryConfig(
          tenantId,
          input.industryId,
          input.enabledCapabilities || [],
          input.enabledWorkflows || []
        );

        logger.info("[Industry Config Router] Industry config updated", {
          tenantId: tenantId,
          userId: ctx.user!.id,
          industryId: input.industryId,
        });

        return {
          success: true,
          data: config,
        };
      } catch (error: any) {
        logger.error("[Industry Config Router] Error setting config", { error, input });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Impossible de mettre à jour la configuration",
        });
      }
    }),

  /**
   * Récupère les workflows standards d'un métier
   * ✅ CORRECTION: Utilise tenantProcedure car les workflows sont globaux
   */
  getIndustryWorkflows: tenantProcedure
    .input(z.object({ industryId: z.string() }))
    .query(async ({ input }: any) => {
      try {
        const workflows = tenantIndustryService.getIndustryWorkflows(input.industryId);
        return {
          success: true,
          data: workflows,
        };
      } catch (error: any) {
        logger.error("[Industry Config Router] Error getting workflows", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workflows non trouvés",
        });
      }
    }),

  /**
   * Récupère les capacités d'un métier
   * ✅ CORRECTION: Utilise tenantProcedure car les capacités sont globales
   */
  getIndustryCapabilities: tenantProcedure
    .input(z.object({ industryId: z.string() }))
    .query(async ({ input }: any) => {
      try {
        const capabilities = tenantIndustryService.getIndustryCapabilities(input.industryId);
        return {
          success: true,
          data: capabilities,
        };
      } catch (error: any) {
        logger.error("[Industry Config Router] Error getting capabilities", error);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Capacités non trouvées",
        });
      }
    }),

  // ============================================
  // AI KEY MANAGEMENT
  // ============================================

  /**
   * Sauvegarde la clé OpenAI du tenant
   * ✅ CORRECTION: Utilise tenantProcedure avec tenantId optionnel
   */
  saveOpenAiKey: tenantProcedure
    .input(
      z.object({
        apiKey: z.string().min(1, "La clé API ne peut pas être vide"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
        const tenantId = ctx.tenantId!;
        if (!tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Accès refusé : aucun tenant associé à votre session",
          });
        }
        
        // Vérifier les permissions
        const userRole = ctx.user!.role;
        if (!['admin', 'manager', 'superadmin'].includes(userRole ?? '')) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Accès réservé aux managers et administrateurs",
          });
        }
        
        // Validation de la clé
        if (!input.apiKey.startsWith("sk-")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Format de clé OpenAI invalide. Elle doit commencer par 'sk-'",
          });
        }

        // Validation optionnelle de la clé
        const isValid = await tenantAiKeyService.validateOpenAiKey(input.apiKey);
        if (!isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "La clé OpenAI est invalide ou expirée",
          });
        }

        // Sauvegarde
        await tenantAiKeyService.saveOpenAiKey(tenantId!, input.apiKey);

        logger.info("OpenAI key saved", {
          tenantId: tenantId,
          userId: ctx.user!.id,
        });
        await AuditService.log({
          tenantId: tenantId!,
          userId: ctx.user!.id,
          action: "RESOURCE_CREATE",  // Closest valid action for resource access
          resource: "openai_key",
          actorType: "human",
          source: 'API',
          metadata: { action: "test_openai_key" }
        });
        return {
          success: true,
          message: "Clé OpenAI sauvegardée avec succès",
        };
      } catch (error: any) {
        logger.error("[Industry Config Router] Error saving OpenAI key", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de sauvegarder la clé OpenAI",
        });
      }
    }),

  /**
   * Teste une clé OpenAI avant sauvegarde
   */
  testOpenAiKey: tenantProcedure
    .input(
      z.object({
        apiKey: z.string().min(1, "La clé API ne peut pas être vide"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const isValid = await tenantAiKeyService.validateOpenAiKey(input.apiKey);
        return {
          success: isValid,
          message: isValid ? "Clé valide" : "Clé invalide ou expirée",
        };
      } catch (error: any) {
        return {
          success: false,
          message: "Erreur lors du test de la clé",
        };
      }
    }),

  /**
   * Vérifie si le tenant a une clé OpenAI configurée
   * ✅ CORRECTION: Utilise tenantProcedure et récupère tenantId du contexte
   */
  hasOpenAiKey: tenantProcedure.query(async ({ ctx }) => {
    try {
      // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
      const tenantId = ctx.tenantId!;
      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Accès refusé : aucun tenant associé à votre session",
        });
      }
      const hasKey = await tenantAiKeyService.hasOpenAiKey(tenantId);
      return {
        success: true,
        data: { hasKey },
      };
    } catch (error: any) {
      logger.error("[Industry Config Router] Error checking OpenAI key", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de vérifier la clé OpenAI",
      });
    }
  }),

  /**
   * Supprime la clé OpenAI du tenant
   * ✅ CORRECTION: Utilise tenantProcedure avec tenantId optionnel
   */
  deleteOpenAiKey: tenantProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx, input }) => {
    try {
      // ✅ BLOC 1: Récupérer le tenantId (validation stricte)
      const tenantId = ctx.tenantId!;
      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Accès refusé : aucun tenant associé à votre session",
        });
      }
      await tenantAiKeyService.deleteOpenAiKey(tenantId);
      return { success: true };
    } catch (error: any) {
      logger.error("[Industry Config Router] Error deleting OpenAI key", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Impossible de supprimer la clé OpenAI",
      });
    }
  }),

  /**
   * Récupère les capacités IA activées pour le tenant
   */
  getAICapabilities: tenantProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenantId!;
      const config = await tenantIndustryService.getTenantIndustryConfig(tenantId);
      
      // Mapper enabledCapabilities (array) vers l'objet attendu par le front
      const caps = config?.enabledCapabilities || [];
      return {
        autoQualify: caps.includes("autoQualify"),
        autoSchedule: caps.includes("autoSchedule"),
        sentimentAnalysis: caps.includes("sentimentAnalysis"),
        humanHandoff: caps.includes("humanHandoff"),
      };
    } catch (error: any) {
      logger.error("[Industry Config Router] Error getting AI capabilities", error);
      return { autoQualify: false, autoSchedule: false, sentimentAnalysis: false, humanHandoff: false };
    }
  }),

  /**
   * Met à jour les capacités IA du tenant
   */
  updateAICapabilities: tenantProcedure
    .input(z.object({
      autoQualify: z.boolean().optional(),
      autoSchedule: z.boolean().optional(),
      sentimentAnalysis: z.boolean().optional(),
      humanHandoff: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId!;
        const currentConfig = await tenantIndustryService.getTenantIndustryConfig(tenantId);
        
        if (!currentConfig) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Configuration métier non trouvée. Veuillez d'abord choisir un métier.",
          });
        }

        // Construire la nouvelle liste de capacités
        const newCaps = new Set(currentConfig.enabledCapabilities || []);
        
        if (input.autoQualify !== undefined) input.autoQualify ? newCaps.add("autoQualify") : newCaps.delete("autoQualify");
        if (input.autoSchedule !== undefined) input.autoSchedule ? newCaps.add("autoSchedule") : newCaps.delete("autoSchedule");
        if (input.sentimentAnalysis !== undefined) input.sentimentAnalysis ? newCaps.add("sentimentAnalysis") : newCaps.delete("sentimentAnalysis");
        if (input.humanHandoff !== undefined) input.humanHandoff ? newCaps.add("humanHandoff") : newCaps.delete("humanHandoff");

        await tenantIndustryService.setTenantIndustryConfig(
          tenantId,
          currentConfig.industryId,
          Array.from(newCaps),
          currentConfig.enabledWorkflows
        );

        return { success: true };
      } catch (error: any) {
        logger.error("[Industry Config Router] Error updating AI capabilities", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Impossible de mettre à jour les capacités IA",
        });
      }
    }),
});
