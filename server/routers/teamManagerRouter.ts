/**
 * TEAM MANAGER ROUTER
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 * ✅ Logic moved to UserService
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { UserService } from "../services/userService";
import { logger } from "../infrastructure/logger";

export const teamManagerRouter = router({

  /**
   * Créer un compte Agent ou Manager avec mot de passe
   */
  createMember: adminProcedure
    .input(z.object({
      email: z.string().email("Email invalide"),
      name: z.string().min(2, "Nom requis"),
      role: z.enum(["manager", "agent", "viewer"]),
      password: z.string().min(8, "Mot de passe minimum 8 caractères"),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      try {
        const user = await UserService.inviteOrAddMember(ctx.tenantId, input);
        
        logger.info("[TeamManager] Member created/added", {
          tenantId: ctx.tenantId, userId: user.id, role: input.role, email: input.email
        });

        return { success: true, userId: user.id };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        logger.error("[TeamManager] createMember failed", { err: err.message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la création du compte" });
      }
    }),

  /**
   * Réinitialiser le mot de passe d'un membre
   */
  resetPassword: adminProcedure
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(8, "Mot de passe minimum 8 caractères"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      try {
        const member = await UserService.getTenantMemberById(input.userId, ctx.tenantId);
        if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Membre introuvable dans ce compte" });

        await UserService.resetPassword(input.userId, input.newPassword);

        logger.info("[TeamManager] Password reset", { tenantId: ctx.tenantId, userId: input.userId });
        return { success: true };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        logger.error("[TeamManager] resetPassword failed", { err: err.message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erreur lors de la réinitialisation" });
      }
    }),

  /**
   * Mettre à jour rôle et statut d'un membre
   */
  updateMemberRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["admin", "manager", "agent", "viewer"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const member = await UserService.getTenantMemberById(input.userId, ctx.tenantId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Membre introuvable" });

      await UserService.updateMember(input.userId, ctx.tenantId, {
        role: input.role,
        isActive: input.isActive,
      });

      logger.info("[TeamManager] Member updated", { tenantId: ctx.tenantId, userId: input.userId, changes: input });
      return { success: true };
    }),

  /**
   * Supprimer un membre du tenant
   */
  removeMember: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const member = await UserService.getTenantMemberById(input.userId, ctx.tenantId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Membre introuvable" });

      await UserService.removeMember(input.userId, ctx.tenantId);
      logger.info("[TeamManager] Member removed from tenant", { tenantId: ctx.tenantId, userId: input.userId });
      return { success: true };
    }),

  /**
   * Liste complète de l'équipe avec stats de base
   */
  getTeamWithStats: managerProcedure
    .query(async ({ ctx }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      
      const members = await UserService.getTenantMembers(ctx.tenantId);
      // On pourrait enrichir avec des stats via ReportingService ou UserService
      return members;
    }),

  /**
   * Analyse des patterns de performance par agent
   */
  getAgentPatterns: managerProcedure
    .input(z.object({
      days: z.number().min(7).max(365).default(30),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return await UserService.getAgentPatterns(ctx.tenantId, input.days);
    }),
});
