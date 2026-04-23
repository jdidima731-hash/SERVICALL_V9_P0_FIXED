/**
 * Service de Recrutement Amélioré
 * Gestion des CVs, offres d'emploi, matching IA, RDV et exigences client
 */
import OpenAI from 'openai';
import { AI_MODEL } from '../_core/aiModels';
import { getDbInstance } from "../db";
import { 
  candidateInterviews, 
  recruitmentJobRequirements,
  recruitmentRdvSlots,
  jobOffers,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { getOpenAIClient } from "../_core/openaiClient";
import { logger } from "../infrastructure/logger";
import { sendEmail } from "./notificationService";

export interface CVParseResult {
  skills: string[];
  experience: { title: string; company: string; duration: string; description?: string }[];
  education: { degree: string; institution: string; year?: string }[];
  languages: string[];
  summary?: string;
  yearsOfExperience?: number;
  salary?: string;
  availability?: string;
  location?: string;
}

export interface MatchingResult {
  matchingScore: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  salaryMatch: number;
  overallFit: "excellent" | "good" | "fair" | "poor";
  strengths: string[];
  gaps: string[];
}

export interface AIGeneratedProfile {
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: number;
  educationLevel: string;
  personalityTraits: string[];
  dealBreakers: string[];
  salaryRange?: string;
  contractType?: string;
  workMode?: string;
  keywords: string[];
  scoringCriteria: {
    criterion: string;
    weight: number;
    description: string;
  }[];
}

export class RecruitmentServiceEnhanced {
  private openai: OpenAI;

  constructor() {
    this.openai = getOpenAIClient();
  }

  /**
   * Parser un CV en base64 et extraire les informations
   */
  async parseCV(cvBase64: string, fileName: string): Promise<CVParseResult> {
    try {
      logger.info({ fileName }, "[Recruitment] Parsing CV");

      const systemPrompt = `Tu es un expert en analyse de CV. Extrais les informations suivantes du CV fourni en format JSON:
- skills: array de compétences
- experience: array d'objets {title, company, duration, description}
- education: array d'objets {degree, institution, year}
- languages: array de langues
- summary: résumé du profil
- yearsOfExperience: nombre d'années
- salary: salaire attendu si mentionné
- availability: disponibilité si mentionnée
- location: localisation si mentionnée

Réponds UNIQUEMENT avec du JSON valide, sans texte supplémentaire.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyse ce CV (base64): ${cvBase64.substring(0, 100)}...` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      return {
        skills: parsed.skills || [],
        experience: parsed.experience || [],
        education: parsed.education || [],
        languages: parsed.languages || [],
        summary: parsed.summary,
        yearsOfExperience: parsed.yearsOfExperience,
        salary: parsed.salary,
        availability: parsed.availability,
        location: parsed.location,
      };
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to parse CV", { error });
      throw error;
    }
  }

  /**
   * Générer un profil idéal basé sur les exigences du client
   */
  async generateProfileFromRequirements(
    tenantId: number,
    jobTitle: string,
    clientRequirements: string
  ): Promise<AIGeneratedProfile> {
    try {
      logger.info({ jobTitle, tenantId }, "[Recruitment] Generating ideal profile");

      const systemPrompt = `Tu es un expert en recrutement et en définition de profils candidats. 
Basé sur les exigences du client, génère un profil candidat idéal en JSON avec les champs demandés.
Réponds UNIQUEMENT avec du JSON valide.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Poste: ${jobTitle}\n\nExigences du client:\n${clientRequirements}` },
        ],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content) as AIGeneratedProfile;
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to generate profile", { error });
      throw error;
    }
  }

  /**
   * Matcher un candidat avec une offre d'emploi
   */
  async matchCandidateWithJob(
    tenantId: number,
    candidateCV: CVParseResult,
    jobProfile: AIGeneratedProfile
  ): Promise<MatchingResult> {
    try {
      logger.info({ tenantId }, "[Recruitment] Matching candidate with job");

      const systemPrompt = `Tu es un expert en matching candidat-poste. Analyse le candidat et le profil idéal.
Réponds avec un JSON contenant le matchingScore, skillsMatch, etc.
Réponds UNIQUEMENT avec du JSON valide.`;

      const response = await this.openai.chat.completions.create({
        model: AI_MODEL.DEFAULT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `CV du candidat:\n${JSON.stringify(candidateCV, null, 2)}\n\nProfil idéal:\n${JSON.stringify(jobProfile, null, 2)}` },
        ],
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content) as MatchingResult;
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to match candidate", { error });
      throw error;
    }
  }

  /**
   * Créer une offre d'emploi
   */
  async createJobOffer(data: {
    tenantId: number;
    title: string;
    description: string;
    department?: string;
    location?: string;
    salaryRange?: string;
    contractType?: string;
    skillsRequired?: string[];
    experienceYears?: number;
    educationLevel?: string;
    remoteWork?: string;
    priority?: string;
    positionsCount?: number;
  }): Promise<any> {
    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      logger.info({ tenantId: data.tenantId, title: data.title }, "[Recruitment] Creating job offer");

      const result = await db.insert(jobOffers).values({
        tenantId: data.tenantId,
        title: data.title,
        description: data.description,
        department: data.department || null,
        location: data.location || null,
        salaryRange: data.salaryRange || null,
        contractType: data.contractType || null,
        skillsRequired: data.skillsRequired || [],
        experienceYears: data.experienceYears || null,
        educationLevel: data.educationLevel || null,
        remoteWork: data.remoteWork || null,
        priority: data.priority || 'medium',
        positionsCount: data.positionsCount || 1,
        isActive: true,
      }).returning();

      return result[0];
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to create job offer", { error });
      throw error;
    }
  }

  /**
   * Mettre à jour une offre d'emploi
   */
  async updateJobOffer(jobOfferId: number, tenantId: number, data: any): Promise<any> {
    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      logger.info({ jobOfferId, tenantId }, "[Recruitment] Updating job offer");

      const result = await db.update(jobOffers)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(
          eq(jobOffers.id, jobOfferId),
          eq(jobOffers.tenantId, tenantId)
        ))
        .returning();

      return result[0];
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to update job offer", { error });
      throw error;
    }
  }

  /**
   * Récupérer les offres d'emploi
   */
  async getJobOffers(tenantId: number, filters?: any): Promise<any[]> {
    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      const conditions = [
        eq(jobOffers.tenantId, tenantId),
        eq(jobOffers.isActive, true),
      ];

      if (filters?.priority) {
        conditions.push(eq(jobOffers.priority, filters.priority));
      }

      return await db.select()
        .from(jobOffers)
        .where(and(...conditions))
        .orderBy(desc(jobOffers.createdAt));
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to get job offers", { error });
      throw error;
    }
  }

  /**
   * Créer une exigence client et générer le profil IA
   */
  async createJobRequirement(data: {
    tenantId: number;
    jobOfferId?: number;
    title: string;
    clientRequirementsRaw: string;
  }): Promise<any> {
    try {
      const db = getDbInstance();
      if (!db) throw new Error("Database not available");

      logger.info({ tenantId: data.tenantId }, "[Recruitment] Creating job requirement");

      const aiProfile = await this.generateProfileFromRequirements(
        data.tenantId,
        data.title,
        data.clientRequirementsRaw
      );

      const result = await db.insert(recruitmentJobRequirements).values({
        tenantId: data.tenantId,
        jobOfferId: data.jobOfferId || null,
        title: data.title,
        clientRequirementsRaw: data.clientRequirementsRaw,
        aiGeneratedProfile: aiProfile,
        isActive: true,
      }).returning();

      return result[0];
    } catch (error: unknown) {
      logger.error("[Recruitment] Failed to create job requirement", { error });
      throw error;
    }
  }
}

export const recruitmentServiceEnhanced = new RecruitmentServiceEnhanced();
