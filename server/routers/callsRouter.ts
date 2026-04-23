/**
 * BLOC 2 - Calls Router avec timeouts et gestion d'erreurs renforcée
 * ✅ BLOC 1 FIX: Architecture API -> Service -> Domain -> Infra
 * ✅ Logic moved to CallService
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { tenantProcedure, managerProcedure, adminProcedure } from "../procedures";
import { logger } from "../infrastructure/logger";
import { paginationInput, paginate } from "../_core/pagination";
import { CallService } from "../services/callService";
import { CallDTOSchema } from "../../shared/dto/calls.dto";
import { mapToCallDTO } from "../../shared/dto/calls.dto";

/**
 * Router pour la gestion des appels (Calls)
 */
export const callsRouter = router({
  /**
   * Liste les appels d'un tenant
   */
  list: tenantProcedure
    .input(paginationInput)
    .output(z.object({
      items: z.array(CallDTOSchema),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      try {
        const tenantId = ctx.tenantId!;
        
        logger.info("[Calls Router] Listing calls paginated", {
          tenantId,
          userId: ctx.userId,
          page,
          limit
        });

        const { data, total } = await CallService.list(tenantId, limit, offset);

        logger.info("[Calls Router] Calls retrieved", {
          count: data.length,
          total,
          duration: Date.now() - startTime,
        });

        const items = data.map(c => mapToCallDTO(c));
        return paginate(items, total, input);
      } catch (error: unknown) {
        logger.error("[Calls Router] Error listing calls", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          duration: Date.now() - startTime,
        });

        return paginate([], 0, input);
      }
    }),

  /**
   * Récupère un appel par son ID
   */
  getById: tenantProcedure
    .input(z.object({ callId: z.number() }))
    .output(CallDTOSchema)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();

      try {
        const tenantId = ctx.tenantId!;
        
        logger.info("[Calls Router] Getting call by ID", {
          callId: input.callId,
          tenantId,
        });

        const call = await CallService.getById(input.callId, tenantId);
        
        if (!call) {
          logger.warn("[Calls Router] Call not found", {
            callId: input.callId,
            tenantId,
            duration: Date.now() - startTime,
          });

          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${input.callId} non trouvé`,
          });
        }

        logger.info("[Calls Router] Call retrieved", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return mapToCallDTO(call);
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        logger.error("[Calls Router] Error getting call", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la récupération de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Crée un nouvel enregistrement d'appel
   */
  create: tenantProcedure
    .input(z.object({
      prospectId: z.number().optional(),
      campaignId: z.number().optional(),
      direction: z.enum(["inbound", "outbound"]),
      status: z.enum(["queued", "ringing", "in-progress", "completed", "failed", "no-answer", "busy"]),
      fromNumber: z.string().min(1, "Numéro source requis"),
      toNumber: z.string().min(1, "Numéro destination requis"),
    }))
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      try {
        const tenantId = ctx.tenantId!;
        
        logger.info("[Calls Router] Creating call", {
          tenantId,
          userId: ctx.userId,
          direction: input.direction,
          prospectId: input.prospectId,
        });

        // Validation prospect multi-tenant
        if (input.prospectId !== undefined) {
          const { ProspectService } = await import("../services/prospectService");
          const prospect = await ProspectService.getById(input.prospectId, tenantId);
          if (!prospect) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Prospect #${input.prospectId} introuvable ou inaccessible`,
            });
          }
        }

        const call = await CallService.create(tenantId, ctx.userId, input);

        if (!call) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Échec de la création de l'appel",
          });
        }

        logger.info("[Calls Router] Call created", {
          callId: call.id,
          duration: Date.now() - startTime,
        });

        return call;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        logger.error("[Calls Router] Error creating call", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: ctx.tenantId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la création de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Met à jour un appel existant
   */
  update: managerProcedure
    .input(z.object({
      callId: z.number().positive("Call ID must be positive"),
      status: z.enum(["queued", "ringing", "in-progress", "completed", "failed", "no-answer", "busy"]).optional(),
      duration: z.number().positive("Duration must be positive").optional(),
      recordingUrl: z.string()
        .url("Invalid URL format")
        .startsWith("https://", { message: "Must use HTTPS" })
        .optional(),
      transcription: z.string().max(10000, "Transcription too long").optional(),
      summary: z.string().max(5000, "Summary too long").optional(),
      sentiment: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      const { callId, ...data } = input;

      try {
        const tenantId = ctx.tenantId!;
        
        logger.info("[Calls Router] Updating call", {
          callId,
          tenantId,
          userId: ctx.userId,
        });

        const call = await CallService.getById(callId, tenantId);
        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${callId} non trouvé`,
          });
        }

        const updated = await CallService.update(callId, tenantId, data);

        logger.info("[Calls Router] Call updated", {
          callId,
          duration: Date.now() - startTime,
        });

        return updated;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        logger.error("[Calls Router] Error updating call", {
          error: error instanceof Error ? error.message : String(error),
          callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la mise à jour de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Supprime un appel
   */
  delete: adminProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();

      try {
        const tenantId = ctx.tenantId!;
        
        logger.warn("[Calls Router] Deleting call", {
          callId: input.callId,
          tenantId,
          userId: ctx.userId,
        });

        const call = await CallService.getById(input.callId, tenantId);
        if (!call) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Appel #${input.callId} non trouvé`,
          });
        }

        const result = await CallService.delete(input.callId, tenantId);

        logger.info("[Calls Router] Call deleted", {
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        return result;
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;

        logger.error("[Calls Router] Error deleting call", {
          error: error instanceof Error ? error.message : String(error),
          callId: input.callId,
          duration: Date.now() - startTime,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erreur lors de la suppression de l'appel",
          cause: error,
        });
      }
    }),

  /**
   * Get badge count for sidebar
   */
  getBadgeCount: tenantProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenantId!;
      
      const agentId = ctx.tenantRole === "agent" ? ctx.userId : undefined;
      const countValue = await CallService.countPending(tenantId, agentId);
      
      logger.info("[Calls Router] Badge count retrieved", {
        tenantId,
        userId: ctx.userId,
        role: ctx.tenantRole,
        count: countValue,
      });

      return countValue;
    } catch (error: unknown) {
      logger.error("[Calls Router] Error getting badge count", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: ctx.tenantId,
      });
      return 0;
    }
  }),
});
