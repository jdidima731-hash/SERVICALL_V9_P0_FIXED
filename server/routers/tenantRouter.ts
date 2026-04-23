/**
 * Tenant Router - Gestion des tenants et changement de contexte
 * ✅ BLOC 3 FIX: Typage strict et schémas de sortie
 */

import { router, protectedProcedure, tenantProcedure, adminProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { switchTenant, initializeDefaultTenant, TenantService } from "../services/tenantService";
import { logger } from "../infrastructure/logger";
import { TenantDTOSchema } from "../../shared/dto/tenant.dto";
import { DTOMapperService } from "../services/dtoMapperService";

export const tenantRouter = router({
  /**
   * Récupère un tenant par son ID
   */
  getById: tenantProcedure
    .output(TenantDTOSchema)
    .query(async ({ ctx }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });
      return DTOMapperService.mapTenant(tenant);
    }),

  /**
   * Liste tous les tenants de l'utilisateur
   */
  list: protectedProcedure
    .output(z.array(z.object({
      id: z.number(),
      name: z.string(),
      slug: z.string(),
      role: z.string(),
      isActive: z.boolean(),
    })))
    .query(async ({ ctx }) => {
      const tenants = await TenantService.getUserTenants(ctx.user!.id);
      return tenants.map((t: any) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role,
        isActive: t.isActive,
      }));
    }),

  /**
   * Crée un nouveau tenant
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      phoneNumber: z.string().optional(),
      timezone: z.string().default("UTC"),
      language: z.string().default("fr"),
    }))
    .output(TenantDTOSchema)
    .mutation(async ({ ctx, input }) => {
      const newTenant = await TenantService.create({
        name: input.name,
        slug: input.slug,
        settings: { timezone: input.timezone, language: input.language, phoneNumber: input.phoneNumber },
      }, ctx.user!.id);

      if (!newTenant) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create tenant" });
      return DTOMapperService.mapTenant(newTenant);
    }),

  /**
   * Met à jour un tenant existant
   */
  update: adminProcedure
    .input(z.object({
      name: z.string().optional(),
      settings: z.object({
        phoneNumber: z.string().optional(),
        timezone: z.string().optional(),
        language: z.string().optional(),
        logo: z.string().optional(),
        branding: z.unknown().optional(),
      }).optional(),
    }))
    .output(tenantOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });

      const updateData: any = { name: input.name ?? undefined };
      if (input.settings) {
        const existingSettings = (tenant.settings as Record<string, unknown> | null) ?? {};
        updateData.settings = { ...existingSettings, ...input.settings };
      }
      
      const updated = await TenantService.update(ctx.tenantId, updateData);
      if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update tenant" });
      
      return {
        ...updated,
        businessType: updated.businessType ?? null,
        aiCustomScript: updated.aiCustomScript ?? null,
      };
    }),

  /**
   * Obtenir la liste des tenants de l'utilisateur avec stats
   */
  getUserTenants: adminProcedure
    .output(z.object({
      tenants: z.array(z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string(),
        role: z.string(),
        isActive: z.boolean(),
      })),
      currentTenantId: z.number(),
    }))
    .query(async ({ ctx }) => {
      const tenants = await TenantService.getUserTenants(ctx.user!.id);
      return {
        tenants: tenants.map((t: any) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          role: t.role,
          isActive: t.isActive,
        })),
        currentTenantId: ctx.tenantId,
      };
    }),

  /**
   * Obtenir le tenant actuel
   */
  getCurrentTenant: tenantProcedure
    .output(z.object({
      tenant: z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string(),
        isActive: z.boolean(),
      }),
    }))
    .query(async ({ ctx }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          isActive: tenant.isActive,
        },
      };
    }),

  /**
   * Changer de tenant
   */
  switchTenant: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .output(z.object({ success: z.boolean(), tenantId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const result = await switchTenant(ctx.user!.id, input.tenantId, ctx.res);
      if (!result.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: result.error || "Impossible de changer de tenant" });
      }
      return { success: true, tenantId: input.tenantId };
    }),

  /**
   * Initialiser le tenant par défaut
   */
  initializeDefaultTenant: tenantProcedure
    .output(z.object({ success: z.boolean(), tenantId: z.number(), role: z.string() }))
    .mutation(async ({ ctx }) => {
      const result = await initializeDefaultTenant(ctx.user!.id, ctx.res);
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Aucun tenant disponible" });
      }
      return { success: true, tenantId: result.tenantId, role: result.role };
    }),

  /**
   * Mettre à jour la configuration métier du tenant
   */
  updateBusinessConfig: adminProcedure
    .input(z.object({
      businessType: z.enum([
        "restaurant", "hotel", "real_estate", "clinic", "ecommerce", "artisan", "call_center", "generic"
      ]).optional(),
      aiCustomScript: z.string().optional(),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await TenantService.update(ctx.tenantId, {
        businessType: input.businessType,
        aiCustomScript: input.aiCustomScript,
      });
      return { success: true };
    }),

  /**
   * Récupérer la configuration métier du tenant
   */
  getBusinessConfig: tenantProcedure
    .output(z.object({
      businessType: z.string().nullable(),
      aiCustomScript: z.string().nullable(),
    }))
    .query(async ({ ctx }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      
      return {
        businessType: tenant.businessType ?? null,
        aiCustomScript: tenant.aiCustomScript ?? null,
      };
    }),

  /**
   * Sauvegarde la configuration de l'Agent IA (WhatsApp Owner)
   */
  saveWhatsAppAgentConfig: adminProcedure
    .input(z.object({
      isActive: z.boolean(),
      ownerWhatsappPhone: z.string(),
      briefingTime: z.string(),
      twilioSid: z.string().optional(),
      twilioToken: z.string().optional(),
      capabilities: z.array(z.string()),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });
      
      const existingSettings = (tenant.settings as Record<string, unknown> | null) ?? {};
      const updatedSettings = {
        ...existingSettings,
        whatsappAgent: {
          isActive: input.isActive,
          ownerWhatsappPhone: input.ownerWhatsappPhone,
          briefingTime: input.briefingTime,
          twilioSid: input.twilioSid,
          twilioToken: input.twilioToken,
          capabilities: input.capabilities,
          updatedAt: new Date().toISOString(),
        }
      };
      
      await TenantService.update(ctx.tenantId, { settings: updatedSettings });
      return { success: true };
    }),

  /**
   * Récupère la configuration de l'Agent IA (WhatsApp Owner)
   */
  getWhatsAppAgentConfig: tenantProcedure
    .output(z.object({
      isActive: z.boolean(),
      ownerWhatsappPhone: z.string(),
      briefingTime: z.string(),
      twilioSid: z.string(),
      twilioToken: z.string(),
      capabilities: z.array(z.string()),
      updatedAt: z.string().nullable(),
    }))
    .query(async ({ ctx }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });
      
      const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
      const wa = (settings.whatsappAgent as Record<string, unknown> | null) ?? {};
      return {
        isActive: (wa.isActive as boolean) ?? true,
        ownerWhatsappPhone: (wa.ownerWhatsappPhone as string) ?? "",
        briefingTime: (wa.briefingTime as string) ?? "08:00",
        twilioSid: (wa.twilioSid as string) ?? "",
        twilioToken: (wa.twilioToken as string) ?? "",
        capabilities: (wa.capabilities as string[]) ?? ["crm", "calendar", "briefing"],
        updatedAt: (wa.updatedAt as string) ?? null,
      };
    }),

  /**
   * Récupérer la configuration Brand AI du tenant
   */
  getBrandAIConfig: tenantProcedure
    .output(z.object({
      aiRole: z.string(),
      aiMission: z.string(),
      tagline: z.string(),
      tone: z.string(),
      language: z.string(),
      phoneNumber: z.string(),
      email: z.string(),
      address: z.string(),
      businessHours: z.string(),
      escalationMessage: z.string(),
      websiteUrl: z.string(),
      scrapedContent: z.string(),
      customPricingText: z.string(),
      customInstructions: z.string(),
      includePricing: z.boolean(),
      includeProducts: z.boolean(),
      allowedTopics: z.array(z.string()),
      forbiddenTopics: z.array(z.string()),
      faqItems: z.array(z.any()),
      channelSettings: z.any(),
    }))
    .query(async ({ ctx }) => {
      const tenant = await TenantService.getById(ctx.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant introuvable" });
      
      const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
      const brandAI = (settings.brandAI as Record<string, unknown> | null) ?? {};
      const channelSettings = (settings.channelSettings as Record<string, unknown> | null) ?? {};
      return {
        aiRole: (brandAI.aiRole as string) ?? "",
        aiMission: (brandAI.aiMission as string) ?? "",
        tagline: (brandAI.tagline as string) ?? "",
        tone: (brandAI.tone as string) ?? "professional",
        language: (brandAI.language as string) ?? "fr",
        phoneNumber: (brandAI.phoneNumber as string) ?? "",
        email: (brandAI.email as string) ?? "",
        address: (brandAI.address as string) ?? "",
        businessHours: (brandAI.businessHours as string) ?? "",
        escalationMessage: (brandAI.escalationMessage as string) ?? "",
        websiteUrl: (brandAI.websiteUrl as string) ?? "",
        scrapedContent: (brandAI.scrapedContent as string) ?? "",
        customPricingText: (brandAI.customPricingText as string) ?? "",
        customInstructions: (brandAI.customInstructions as string) ?? "",
        includePricing: (brandAI.includePricing as boolean) ?? false,
        includeProducts: (brandAI.includeProducts as boolean) ?? false,
        allowedTopics: (brandAI.allowedTopics as string[]) ?? [],
        forbiddenTopics: (brandAI.forbiddenTopics as string[]) ?? [],
        faqItems: (brandAI.faqItems as unknown[]) ?? [],
        channelSettings,
      };
    }),
});
