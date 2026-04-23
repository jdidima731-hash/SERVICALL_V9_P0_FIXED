import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { getDbInstance } from "../db";
import { 
  candidateInterviews, 
  interviewQuestions, 
  recruitmentSettings,
  recruitmentJobRequirements,
  jobOffers,
  type CandidateInterview 
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getOpenAIClient } from "../_core/openaiClient";
import { encryptionService } from "./encryptionService";
import { pinoLogger as logger } from "../infrastructure/logger";
import { 
  CVParseResultSchema, 
  type CVParseResult,
  AIGeneratedProfileSchema,
  type AIGeneratedProfile,
  InterviewAnalysisSchema,
  type InterviewAnalysis
} from "../../shared/validation/recruitment";

/**
 * RECRUITMENT SERVICE — SERVICALL V8
 * ✅ BLOC 1 HARDENING: JSONB + AI Validation
 */

export class RecruitmentService {
  private openai: OpenAI;

  constructor() {
    this.openai = getOpenAIClient();
  }

  // --- Gestion des Entretiens (Base) ---

  async createInterview(data: {
    tenantId: number;
    candidateName: string;
    candidateEmail?: string;
    candidatePhone: string;
    businessType: string;
    jobPosition: string;
    scheduledAt?: Date;
    source?: "platform" | "manual" | "referral" | "job_board" | "other";
    metadata?: Record<string, unknown>;
  }): Promise<CandidateInterview> {
    const db = getDbInstance();
    try {
      logger.info(`Creating new candidate interview for tenant ${data.tenantId}`);

      const encryptOpts = { tenantId: data.tenantId, dataType: 'personal' as const };
      const encryptedName = await encryptionService.encrypt(data.candidateName, encryptOpts);
      const encryptedEmail = data.candidateEmail 
        ? await encryptionService.encrypt(data.candidateEmail, encryptOpts) 
        : null;
      const encryptedPhone = await encryptionService.encrypt(data.candidatePhone, encryptOpts);

      const settings = await this.getRecruitmentSettings(data.tenantId, data.businessType);
      const retentionDays = settings?.dataRetentionDays ?? 90;
      const dataRetentionUntil = new Date();
      dataRetentionUntil.setDate(dataRetentionUntil.getDate() + retentionDays);

      const [interview] = await db.insert(candidateInterviews).values({
        tenantId: data.tenantId,
        candidateName: encryptedName,
        candidateEmail: encryptedEmail,
        candidatePhone: encryptedPhone,
        businessType: data.businessType,
        jobPosition: data.jobPosition,
        scheduledAt: data.scheduledAt || new Date(),
        source: (data.source as unknown) || "platform",
        status: "pending",
        consentGiven: true,
        dataRetentionUntil,
        metadata: data.metadata || {},
      }).returning();

      return interview;
    } catch (error: unknown) {
      logger.error(`Failed to create interview for tenant ${data.tenantId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // --- Fonctionnalités Améliorées (Enhanced) ---

  async parseCV(cvBase64: string, fileName: string): Promise<CVParseResult> {
    try {
      logger.info(`[Recruitment] Parsing CV: ${fileName}`);
      const systemPrompt = `Tu es un expert en analyse de CV. Extrais les informations suivantes du CV fourni en format JSON:
      - skills, experience, education, languages, summary, yearsOfExperience, salary, availability, location.
      Réponds UNIQUEMENT avec du JSON valide.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt }, 
          { role: "user", content: `Analyse ce CV: ${cvBase64.substring(0, 100)}...` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response during CV parsing");

      const rawJson = JSON.parse(content);
      return CVParseResultSchema.parse(rawJson);

    } catch (error: unknown) {
      logger.error(`[Recruitment] Failed to parse CV: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async generateProfileFromRequirements(tenantId: number, jobTitle: string, clientRequirements: string): Promise<AIGeneratedProfile> {
    try {
      logger.info(`[Recruitment] Generating ideal profile for ${jobTitle} (Tenant ${tenantId})`);
      const systemPrompt = `Génère un profil candidat idéal en JSON basé sur les exigences client. Réponds avec un objet JSON valide respectant les champs demandés.`;
      
      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt }, 
          { role: "user", content: `Poste: ${jobTitle}\nExigences: ${clientRequirements}` }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response during profile generation");

      const rawJson = JSON.parse(content);
      return AIGeneratedProfileSchema.parse(rawJson);

    } catch (error: unknown) {
      logger.error(`[Recruitment] Failed to generate profile: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // --- Offres d'Emploi ---

  async createJobOffer(tenantId: number, data: any): Promise<any> {
    const db = getDbInstance();
    const [result] = await db.insert(jobOffers).values({ 
      ...data, 
      tenantId,
      isActive: true 
    }).returning();
    return result;
  }

  async getJobOffers(tenantId: number): Promise<any[]> {
    const db = getDbInstance();
    return await db.query.jobOffers.findMany({
      where: and(eq(jobOffers.tenantId, tenantId), eq(jobOffers.isActive, true)),
      orderBy: [desc(jobOffers.createdAt)],
    });
  }

  // --- Helpers & Settings ---

  async getRecruitmentSettings(tenantId: number, businessType: string): Promise<any> {
    const db = getDbInstance();
    return await db.query.recruitmentSettings.findFirst({
      where: and(eq(recruitmentSettings.tenantId, tenantId), eq(recruitmentSettings.businessType, businessType)),
    });
  }

  async getInterviewQuestions(tenantId: number, businessType: string): Promise<any[]> {
    const db = getDbInstance();
    return await db.query.interviewQuestions.findMany({
      where: and(eq(interviewQuestions.tenantId, tenantId), eq(interviewQuestions.businessType, businessType)),
      orderBy: [desc(interviewQuestions.weight)],
    });
  }

  // --- Analyse & Scripts ---

  async analyzeResponses(interviewId: number, transcript: string): Promise<InterviewAnalysis> {
    const db = getDbInstance();
    const interview = await db.query.candidateInterviews.findFirst({ where: eq(candidateInterviews.id, interviewId) });
    if (!interview) throw new Error("Interview not found");
    
    const settings = await this.getRecruitmentSettings(interview.tenantId, interview.businessType);
    
    const systemPrompt = `Tu es un expert en recrutement. Analyse cet entretien basé sur le transcript fourni. 
    Retourne une analyse complète au format JSON incluant globalScore (0-10), criteriaScores, behavioralAnalysis, redFlags et strengths.`;

    const response = await this.openai.chat.completions.create({
      model: settings?.aiModel || AI_MODEL.DEFAULT,
      messages: [
        { role: "system", content: systemPrompt }, 
        { role: "user", content: transcript }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("Empty AI response during interview analysis");

    const rawJson = JSON.parse(content);
    return InterviewAnalysisSchema.parse(rawJson);
  }
}

export const recruitmentService = new RecruitmentService();
