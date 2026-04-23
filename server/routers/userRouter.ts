import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure, managerProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { UserService } from "../services/userService";
import { logger } from "../infrastructure/logger";
import { paginationInput, paginate } from "../_core/pagination";
import { UserPublicDTOSchema } from "../../shared/dto/user.dto";
import { DTOMapperService } from "../services/dtoMapperService";

/**
 * Router pour la gestion des utilisateurs et membres de l'équipe
 * ✅ BLOC 3 FIX: Typage strict et schémas de sortie
 */
export const userRouter = router({
  /**
   * Liste tous les membres de l'équipe pour le tenant actuel
   */
  getTeamMembers: managerProcedure
    .input(paginationInput)
    .output(z.object({
      items: z.array(UserPublicDTOSchema),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const members = await UserService.getTenantMembers(ctx.tenantId);
        const total = members.length;
        const offset = (input.page - 1) * input.limit;
        const paginatedMembers = members.slice(offset, offset + input.limit);

        const data = DTOMapperService.mapUsers(paginatedMembers);
        return paginate(data, total, input);
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to get team members", { error, tenantId: ctx.tenantId });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get team members" });
      }
    }),

  /**
   * Invite un nouvel utilisateur ou l'ajoute au tenant
   */
  inviteMember: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["admin", "manager", "agent", "viewer"]),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await UserService.inviteOrAddMember(ctx.tenantId, input);
        
        logger.info("[UserRouter] Member invited", { 
          tenantId: ctx.tenantId, 
          invitedEmail: input.email,
          role: input.role 
        });

        return { success: true };
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to invite member", { error, tenantId: ctx.tenantId });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to invite member" });
      }
    }),

  /**
   * Met à jour le rôle ou le statut d'un membre
   */
  updateMember: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const member = await UserService.getTenantMemberById(input.userId, ctx.tenantId);
        if (!member) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found in this tenant" });
        }
        
        await UserService.updateMember(input.userId, ctx.tenantId, {
          role: input.role,
          isActive: input.isActive,
        });
        
        return { success: true };
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to update member", { error, userId: input.userId });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update member" });
      }
    }),

  /**
   * Récupère les KPIs de l'équipe pour les managers
   */
  getTeamKPIs: managerProcedure
    .output(teamKPIsSchema)
    .query(async ({ ctx }) => {
      try {
        const result = await UserService.getTeamKPIs(ctx.tenantId);
        return teamKPIsSchema.parse(result);
      } catch (error: unknown) {
        logger.error("[UserRouter] Failed to get team KPIs", { error, tenantId: ctx.tenantId });
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get team KPIs" });
      }
    }),
});
