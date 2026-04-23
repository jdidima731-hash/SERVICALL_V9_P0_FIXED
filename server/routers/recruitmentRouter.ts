import { z } from "zod";
import { router } from "../_core/trpc";
import { managerProcedure, tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { candidateInterviews, jobOffers } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../infrastructure/logger";
import { paginationInput, paginate } from "../_core/pagination";
import { 
  paginatedInterviewSchema, 
  recruitmentStatsSchema,
  interviewSchema
} from "../../shared/validation/recruitment";
import { recruitmentService } from "../services/RecruitmentService";
import { 
  CandidateInterviewDTOSchema, 
  JobOfferDTOSchema,
  mapToCandidateInterviewDTO,
  mapToJobOfferDTO
} from "../../shared/dto/recruitment.dto";
import { DTOMapperService } from "../services/dtoMapperService";

/**
 * RECRUITMENT ROUTER - CONSOLIDÉ (Standard + Enhanced)
 * ─────────────────────────────────────────────────────────────
 * ✅ Unification des fonctionnalités de base et IA
 * ✅ Suppression des routeurs redondants
 * ─────────────────────────────────────────────────────────────
 */
export const recruitmentRouter = router({
  /**
   * Liste les entretiens avec pagination et filtres
   */
  listInterviews: tenantProcedure
    .input(paginationInput.extend({
      status: z.string().optional(),
      businessType: z.string().optional(),
    }))
    .output(z.object({
      items: z.array(CandidateInterviewDTOSchema),
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, status, businessType } = input;
      const offset = (page - 1) * limit;

      try {
        const conditions = [eq(candidateInterviews.tenantId, ctx.tenantId!)];
        if (status) conditions.push(eq(candidateInterviews.status, status));
        if (businessType) conditions.push(eq(candidateInterviews.businessType, businessType));

        const [data, totalResult] = await Promise.all([
          db.db.select().from(candidateInterviews)
            .where(and(...conditions))
            .limit(limit)
            .offset(offset)
            .orderBy(desc(candidateInterviews.createdAt)),
          db.db.select({ value: sql`count(*)` })
            .from(candidateInterviews)
            .where(and(...conditions))
        ]);

        const items = data.map(i => mapToCandidateInterviewDTO(i as any));
        return paginate(items as any, Number(totalResult[0]?.value ?? 0), input);
      } catch (error: any) {
        logger.error("[RecruitmentRouter] Failed to list interviews", { error });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list interviews" });
      }
    }),

  /**
   * Crée un nouvel entretien
   */
  createInterview: managerProcedure
    .input(z.object({
      candidateName: z.string(),
      candidateEmail: z.string().email().optional(),
      candidatePhone: z.string(),
      jobPosition: z.string(),
      scheduledAt: z.string().optional(),
      businessType: z.string().optional(),
    }))
    .output(z.any())
    .mutation(async ({ input, ctx }: any) => {
      try {
        const interview = await recruitmentService.createInterview({
          ...input,
          tenantId: ctx.tenantId!,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined
        });
        return interview;
      } catch (error: any) {
        logger.error("[RecruitmentRouter] Failed to create interview", { error });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create interview" });
      }
    }),

  /**
   * --- Fonctionnalités Améliorées (Ex-Enhanced) ---
   */
  getJobOffers: tenantProcedure
    .input(z.object({}))
    .output(z.array(JobOfferDTOSchema))
    .query(async ({ ctx }) => {
      const offers = await recruitmentService.getJobOffers(ctx.tenantId!);
      return offers.map(o => mapToJobOfferDTO(o));
    }),

  createJobOffer: managerProcedure
    .input(z.object({
      title: z.string(),
      description: z.string(),
      department: z.string().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return await recruitmentService.createJobOffer({ ...input, tenantId: ctx.tenantId! });
    }),

  parseCV: managerProcedure
    .input(z.object({ cvBase64: z.string(), fileName: z.string() }))
    .mutation(async ({ input }) => {
      return await recruitmentService.parseCV(input.cvBase64, input.fileName);
    }),

  /**
   * --- Actions d'Entretien ---
   */
  startInterview: managerProcedure
    .input(z.number())
    .mutation(async ({ input: interviewId, ctx }) => {
      try {
        await (recruitmentService as unknown).receiveCall(interviewId);
        return { success: true, interviewId };
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de démarrer l'entretien" });
      }
    }),

  generateReport: managerProcedure
    .input(z.number())
    .mutation(async ({ input: interviewId, ctx }) => {
      try {
        const report = await recruitmentService.analyzeResponses(interviewId, "Transcript simulé"); // À adapter
        return { success: true, report };
      } catch (error: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de générer le rapport" });
      }
    }),

  getStats: tenantProcedure
    .input(z.object({ businessType: z.string().optional() }))
    .output(recruitmentStatsSchema)
    .query(async ({ input, ctx }: any) => {
      const conditions = [eq(candidateInterviews.tenantId, ctx.tenantId!)];
      if (input.businessType) conditions.push(eq(candidateInterviews.businessType, input.businessType));
      const interviews = await db.db.select().from(candidateInterviews).where(and(...conditions));
      
      return recruitmentStatsSchema.parse({
        total: interviews.length,
        pending: interviews.filter(i => i.status === "pending").length,
        completed: interviews.filter(i => i.status === "completed").length,
        shortlisted: interviews.filter(i => i.status === "shortlisted").length,
        rejected: interviews.filter(i => i.status === "rejected").length,
        averageScore: 75,
      });
    }),
});
