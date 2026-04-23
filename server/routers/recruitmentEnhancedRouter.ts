/**
 * Router Amélioré pour le Module de Recrutement IA
 * Gestion des CVs, offres d'emploi, matching, RDV et exigences client
 */
import { router } from "../_core/trpc";
import { tenantProcedure, managerProcedure } from "../procedures";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { recruitmentServiceEnhanced } from "../services/RecruitmentServiceEnhanced";
import { pinoLogger } from "../infrastructure/logger";
import { db } from "../db";
import { candidateInterviews, jobOffers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ✅ FIX: Utiliser pinoLogger.child() pour avoir la bonne signature Pino (obj, msg)
const logger = pinoLogger.child({ router: "recruitmentEnhanced" });

// ============================================
// SCHEMAS DE VALIDATION
// ============================================

const createJobOfferSchema = z.object({
  title: z.string().min(3, "Titre requis"),
  description: z.string().min(10, "Description requise"),
  department: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  contractType: z.enum(["CDI", "CDD", "Freelance", "Stage"]).optional(),
  skillsRequired: z.array(z.string()).optional(),
  experienceYears: z.number().int().min(0).optional(),
  educationLevel: z.string().optional(),
  remoteWork: z.enum(["onsite", "remote", "hybrid"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  positionsCount: z.number().int().min(1).optional(),
});

const uploadCVSchema = z.object({
  candidateId: z.number().int().positive(),
  cvBase64: z.string().min(100, "CV invalide"),
  fileName: z.string().min(1, "Nom de fichier requis"),
  jobOfferId: z.number().int().positive().optional(),
});

const createJobRequirementSchema = z.object({
  jobOfferId: z.number().int().positive().optional(),
  title: z.string().min(3, "Titre requis"),
  clientRequirementsRaw: z.string().min(20, "Exigences détaillées requises"),
});

const chatAISchema = z.object({
  requirementId: z.number().int().positive(),
  message: z.string().min(1, "Message requis"),
});

const createRdvSlotSchema = z.object({
  slotDate: z.string().datetime(),
  slotDuration: z.number().int().min(15).max(480).optional(),
  assignedTo: z.string().optional(),
  interviewType: z.enum(["phone", "video", "in_person"]).optional(),
  notes: z.string().optional(),
});

const bookRdvSchema = z.object({
  slotId: z.number().int().positive(),
  interviewId: z.number().int().positive(),
});

const sendCandidateSchema = z.object({
  interviewId: z.number().int().positive(),
  clientEmail: z.string().email("Email invalide"),
});

const updateClientDecisionSchema = z.object({
  interviewId: z.number().int().positive(),
  decision: z.enum(["accepted", "rejected", "pending"]),
  feedback: z.string().optional(),
});

// ============================================
// ROUTER AMÉLIORÉ
// ============================================

export const recruitmentEnhancedRouter = router({
  /**
   * Créer une offre d'emploi
   */
  createJobOffer: managerProcedure
    .input(createJobOfferSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          title: input.title,
        }, "[Recruitment] Creating job offer");

        const jobOffer = await recruitmentServiceEnhanced.createJobOffer({
          tenantId: ctx.tenantId!,
          ...input,
        });

        return {
          success: true,
          data: jobOffer,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to create job offer");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de créer l'offre d'emploi",
        });
      }
    }),

  /**
   * Récupérer les offres d'emploi
   */
  getJobOffers: tenantProcedure
    .input(
      z.object({
        priority: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const jobOffers = await recruitmentServiceEnhanced.getJobOffers(ctx.tenantId!, input);

        return {
          success: true,
          data: jobOffers,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to get job offers");
        return {
          success: false,
          data: [],
        };
      }
    }),

  /**
   * Mettre à jour une offre d'emploi
   */
  updateJobOffer: managerProcedure
    .input(
      z.object({
        jobOfferId: z.number().int().positive(),
        data: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          jobOfferId: input.jobOfferId,
        }, "[Recruitment] Updating job offer");

        const jobOffer = await recruitmentServiceEnhanced.updateJobOffer(
          input.jobOfferId,
          ctx.tenantId!,
          input.data
        );

        return {
          success: true,
          data: jobOffer,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to update job offer");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre à jour l'offre d'emploi",
        });
      }
    }),

  /**
   * Parser un CV et extraire les informations
   */
  parseCV: managerProcedure
    .input(uploadCVSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          fileName: input.fileName,
        }, "[Recruitment] Parsing CV");

        const cvData = await recruitmentServiceEnhanced.parseCV(input.cvBase64, input.fileName);

        // Mettre à jour l'entretien avec les données du CV
        if (input.jobOfferId) {
          await db.update(candidateInterviews)
            .set({
              jobOfferId: input.jobOfferId,
              cvFileName: input.fileName,
              
              cvParsedData: cvData as unknown,
              updatedAt: new Date(),
            })
            .where(eq(candidateInterviews.id, input.candidateId));
        }

        return {
          success: true,
          data: cvData,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to parse CV");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de parser le CV",
        });
      }
    }),

  /**
   * Matcher un candidat avec une offre d'emploi
   */
  matchCandidate: managerProcedure
    .input(
      z.object({
        interviewId: z.number().int().positive(),
        jobOfferId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          interviewId: input.interviewId,
          jobOfferId: input.jobOfferId,
        }, "[Recruitment] Matching candidate");

        // Récupérer l'entretien
        const interview = await db.query.candidateInterviews.findFirst({
          where: and(
            eq(candidateInterviews.id, input.interviewId),
            eq(candidateInterviews.tenantId, ctx.tenantId!)
          ),
        });

        if (!interview || !interview.cvParsedData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Entretien ou CV non trouvé",
          });
        }

        // Récupérer l'offre
        const jobOffer = await db.query.jobOffers.findFirst({
          where: and(
            eq(jobOffers.id, input.jobOfferId),
            eq(jobOffers.tenantId, ctx.tenantId!)
          ),
        });

        if (!jobOffer) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Offre d'emploi non trouvée",
          });
        }

        // Créer le profil idéal à partir de l'offre
        const jobProfile = await recruitmentServiceEnhanced.generateProfileFromRequirements(
          ctx.tenantId!,
          jobOffer.title,
          jobOffer.description ?? ""
        );

        // Matcher
        const matchingResult = await recruitmentServiceEnhanced.matchCandidateWithJob(
          ctx.tenantId!,
          interview.cvParsedData as unknown,
          jobProfile
        );

        // Mettre à jour l'entretien
        await db.update(candidateInterviews)
          .set({
            jobOfferId: input.jobOfferId,
            
            matchingScore: matchingResult.matchingScore.toString() as unknown,
            
            matchingDetails: matchingResult as unknown,
            updatedAt: new Date(),
          })
          .where(eq(candidateInterviews.id, input.interviewId));

        return {
          success: true,
          data: matchingResult,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to match candidate");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de matcher le candidat",
        });
      }
    }),

  /**
   * Créer une exigence client et générer le profil IA
   */
  createJobRequirement: managerProcedure
    .input(createJobRequirementSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          title: input.title,
        }, "[Recruitment] Creating job requirement");

        const requirement = await recruitmentServiceEnhanced.createJobRequirement({
          tenantId: ctx.tenantId!,
          jobOfferId: input.jobOfferId,
          title: input.title,
          clientRequirementsRaw: input.clientRequirementsRaw,
        });

        return {
          success: true,
          data: requirement,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to create job requirement");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de créer l'exigence client",
        });
      }
    }),

  /**
   * Chat IA pour affiner les exigences
   */
  chatWithAI: managerProcedure
    .input(chatAISchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          requirementId: input.requirementId,
        }, "[Recruitment] Chat with AI");

        // ✅ FIX: Ordre des paramètres corrigé (requirementId, tenantId, message)
        const response = await recruitmentServiceEnhanced.chatWithAI(
          input.requirementId,
          ctx.tenantId!,
          input.message
        );

        return {
          success: true,
          data: response,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to chat with AI");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de communiquer avec l'IA",
        });
      }
    }),

  /**
   * Créer un créneau de RDV
   */
  createRdvSlot: managerProcedure
    .input(createRdvSlotSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          slotDate: input.slotDate,
        }, "[Recruitment] Creating RDV slot");

        const slot = await recruitmentServiceEnhanced.createRdvSlot({
          tenantId: ctx.tenantId!,
          slotDate: new Date(input.slotDate),
          slotDuration: input.slotDuration,
          assignedTo: input.assignedTo,
          interviewType: input.interviewType,
          notes: input.notes,
        });

        return {
          success: true,
          data: slot,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to create RDV slot");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de créer le créneau RDV",
        });
      }
    }),

  /**
   * Récupérer les créneaux disponibles
   */
  getAvailableSlots: tenantProcedure
    .input(
      z.object({
        fromDate: z.string().datetime(),
        toDate: z.string().datetime(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const slots = await recruitmentServiceEnhanced.getAvailableSlots(
          ctx.tenantId!,
          new Date(input.fromDate),
          new Date(input.toDate)
        );

        return {
          success: true,
          data: slots,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to get available slots");
        return {
          success: false,
          data: [],
        };
      }
    }),

  /**
   * Réserver un créneau pour un entretien
   */
  bookRdvSlot: managerProcedure
    .input(bookRdvSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          slotId: input.slotId,
        }, "[Recruitment] Booking RDV slot");

        const slot = await recruitmentServiceEnhanced.bookRdvSlot(
          input.slotId,
          ctx.tenantId!,
          input.interviewId
        );

        return {
          success: true,
          data: slot,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to book RDV slot");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de réserver le créneau",
        });
      }
    }),

  /**
   * Envoyer un candidat au client
   */
  sendCandidateToClient: managerProcedure
    .input(sendCandidateSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          interviewId: input.interviewId,
        }, "[Recruitment] Sending candidate to client");

        await recruitmentServiceEnhanced.sendCandidateToClient(
          input.interviewId,
          ctx.tenantId!,
          input.clientEmail
        );

        return {
          success: true,
          message: "Candidat envoyé au client",
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to send candidate");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible d'envoyer le candidat",
        });
      }
    }),

  /**
   * Mettre à jour la décision du client
   */
  updateClientDecision: managerProcedure
    .input(updateClientDecisionSchema)
    .mutation(async ({ input, ctx }: any) => {
      try {
        logger.info({
          tenantId: ctx.tenantId!,
          interviewId: input.interviewId,
        }, "[Recruitment] Updating client decision");

        const interview = await recruitmentServiceEnhanced.updateClientDecision(
          input.interviewId,
          ctx.tenantId!,
          input.decision,
          input.feedback
        );

        return {
          success: true,
          data: interview,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to update client decision");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de mettre à jour la décision",
        });
      }
    }),

  /**
   * Obtenir les statistiques du recrutement
   */
  getRecruitmentStats: tenantProcedure
    .input(
      z.object({
        businessType: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }: any) => {
      try {
        const stats = await recruitmentServiceEnhanced.getRecruitmentStats(ctx.tenantId!, input);

        return {
          success: true,
          data: stats,
        };
      } catch (error: any) {
        logger.error({ error }, "[Recruitment] Failed to get stats");
        return {
          success: false,
          data: null,
        };
      }
    }),
});