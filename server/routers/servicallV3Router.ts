/**
 * SERVICALL v2 — Router Intelligence Centrale
 *
 * Expose les 4 modules IA :
 *   1. analyzeInterview  — Analyse d'entretien (scores, red flags, behavioral)
 *   2. generateSummary   — Résumé professionnel décisionnel (3 points + décision)
 *   3. qualifyCall       — Qualification appels entrants (intent, urgence, transfert)
 *   4. parseDocument     — Parsing CV / Mails (extraction automatisée)
 *
 * Température : 0.3 pour analyse technique, 0.7 pour résumés
 * Réponse : JSON strict, 100% Français
 */
import { z } from "zod";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../procedures";
import { TRPCError } from "@trpc/server";
import { getOpenAIClient } from "../_core/openaiClient";
import { AI_MODEL } from "../_core/aiModels";
import { pinoLogger } from "../infrastructure/logger";

const logger = pinoLogger.child({ router: "servicallV3" });

// ============================================================
// SYSTEM PROMPTS — Servicall v2
// ============================================================

const INTERVIEW_SYSTEM_PROMPT = (businessType: string) => `Tu es l'Intelligence Centrale de Servicall v2, combinant Expert Senior en Recrutement, Psychologue du Travail et Chasseur de Têtes.
Secteur d'activité : "${businessType}".

Analyse le transcript d'entretien fourni et évalue :
1. Compétences techniques — Adéquation avec le poste
2. Communication — Clarté, articulation, capacité d'expression
3. Cohérence — Logique des réponses, absence de contradictions
4. Honnêteté — Détection de mensonges potentiels, exagérations
5. Motivation — Intérêt réel pour le poste

Repère les hésitations, contradictions, réponses vagues et points faibles.
Détecte les signaux faibles et les red flags.

Réponds UNIQUEMENT en JSON valide selon ce format exact :
{
  "criteriaScores": {
    "technical": { "score": 7.5, "comment": "...", "weight": 1.5 },
    "communication": { "score": 8.0, "comment": "...", "weight": 1.2 },
    "coherence": { "score": 6.5, "comment": "...", "weight": 1.3 },
    "honesty": { "score": 7.0, "comment": "...", "weight": 1.4 },
    "motivation": { "score": 8.5, "comment": "...", "weight": 1.1 }
  },
  "behavioralAnalysis": {
    "emotions": ["confident", "calm"],
    "emotionTimeline": [
      { "timestamp": 30, "emotion": "nervous", "intensity": 0.6 },
      { "timestamp": 120, "emotion": "confident", "intensity": 0.8 }
    ],
    "coherenceScore": 7.5,
    "honestyScore": 8.0,
    "communicationScore": 8.5
  },
  "redFlags": ["Contradiction sur l'expérience précédente"],
  "strengths": ["Excellente communication", "Motivation claire"],
  "culturalFit": 7.8,
  "globalScore": 7.5
}
100% Français. JSON strict sans texte supplémentaire.`;

const SUMMARY_SYSTEM_PROMPT = (businessType: string) => `Tu es l'Intelligence Centrale de Servicall v2 — Module Résumé Professionnel Décisionnel.
Secteur : "${businessType}".

Génère une note de synthèse décisionnelle en 3 points maximum (4 phrases max, ton direct, analytique, professionnel).

Réponds UNIQUEMENT en JSON valide :
{
  "globalProfile": "Description du profil global en 1-2 phrases",
  "differentiatingStrength": "Point fort différenciant en 1 phrase",
  "majorRiskOrRecommendation": "Risque majeur ou recommandation de suivi en 1 phrase",
  "decisionRecommendation": "RECRUTER",
  "confidence": 0.85
}
decisionRecommendation doit être exactement : "RECRUTER", "ENTRETIEN_COMPLEMENTAIRE" ou "REJETER".
100% Français. JSON strict.`;

const CALL_QUALIFICATION_PROMPT = (businessType: string, departments: string[]) => `Tu es l'Intelligence Centrale de Servicall v2 — Module Qualification Appels Entrants.
Secteur : "${businessType}". Départements disponibles : ${departments.join(", ")}.

Extrais les informations suivantes de la transcription et réponds UNIQUEMENT en JSON valide :
{
  "callerName": "Nom ou null",
  "callerCompany": "Entreprise ou null",
  "callerPhone": "Téléphone ou null",
  "callerEmail": "Email ou null",
  "callIntent": "Vente",
  "urgency": "medium",
  "shouldTransferImmediately": false,
  "recommendedDepartment": "Commercial",
  "summary": "Résumé de la demande",
  "notes": "Notes additionnelles"
}
callIntent doit être exactement : "Vente", "Support", "Réclamation", "Administratif" ou "Autre".
urgency doit être exactement : "high", "medium" ou "low".
Transfert immédiat si urgency="high" ou demande complexe nécessitant expertise humaine.
100% Français. JSON strict.`;

const CV_PARSING_PROMPT = `Tu es l'Intelligence Centrale de Servicall v2 — Module Parsing CV.
Extrais les informations suivantes du CV fourni et réponds UNIQUEMENT en JSON valide :
{
  "fullName": "Nom complet ou null",
  "email": "Email ou null",
  "phone": "Téléphone ou null",
  "currentPosition": "Poste actuel ou null",
  "yearsOfExperience": 0,
  "topSkills": ["compétence1", "compétence2", "compétence3", "compétence4", "compétence5"],
  "educationLevel": "Niveau de formation ou null"
}
topSkills : exactement les 5 compétences les plus pertinentes.
100% Français. JSON strict.`;

const MAIL_PARSING_PROMPT = `Tu es l'Intelligence Centrale de Servicall v2 — Module Parsing Mail de Candidature.
Extrais les informations suivantes du mail fourni et réponds UNIQUEMENT en JSON valide :
{
  "fullName": "Nom complet ou null",
  "email": "Email ou null",
  "phone": "Téléphone ou null",
  "currentPosition": "Poste actuel ou null",
  "yearsOfExperience": 0,
  "topSkills": ["compétence1", "compétence2", "compétence3", "compétence4", "compétence5"],
  "educationLevel": "Niveau de formation ou null",
  "motivationArguments": ["argument1", "argument2", "argument3"]
}
motivationArguments : les 3 arguments principaux de la lettre de motivation (si présente).
100% Français. JSON strict.`;

// ============================================================
// ROUTER
// ============================================================

export const servicallV3Router = router({
  /**
   * MODULE 1 — Analyse d'Entretien
   * Évalue : technique, communication, cohérence, honnêteté, motivation
   * Température : 0.3 (analyse technique précise)
   */
  analyzeInterview: tenantProcedure
    .input(
      z.object({
        transcript: z.string().min(50, "Le transcript doit contenir au moins 50 caractères"),
        businessType: z.string().min(1).default("centre d'appels"),
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        logger.info({ businessType: input.businessType }, "[ServicecallV3] Analyzing interview");
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
          model: AI_MODEL.DEFAULT,
          messages: [
            { role: "system", content: INTERVIEW_SYSTEM_PROMPT(input.businessType) },
            { role: "user", content: `Transcript de l'entretien :\n\n${input.transcript}` },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        });
        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content);

        // Calcul du score global pondéré si non fourni
        if (!result.globalScore && result.criteriaScores) {
          let totalWeighted = 0;
          let totalWeight = 0;
          for (const val of Object.values(result.criteriaScores) as unknown[]) {
            
            if (val?.score !== undefined && val?.weight !== undefined) {
              
              totalWeighted += (val as unknown).score * (val as unknown).weight;
              
              totalWeight += (val as unknown).weight;
            }
          }
          result.globalScore = totalWeight > 0
            ? Math.round((totalWeighted / totalWeight) * 10) / 10
            : 0;
        }

        logger.info({ globalScore: result.globalScore }, "[ServicecallV3] Interview analyzed");
        return result;
      } catch (error: any) {
        logger.error({ error }, "[ServicecallV3] Failed to analyze interview");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible d'analyser l'entretien",
          cause: error,
        });
      }
    }),

  /**
   * MODULE 2 — Résumé Professionnel Décisionnel
   * 3 points : profil global, point fort, risque/recommandation
   * Température : 0.7 (résumés synthétiques)
   */
  generateSummary: tenantProcedure
    .input(
      z.object({
        transcript: z.string().min(50, "Le transcript doit contenir au moins 50 caractères"),
        businessType: z.string().min(1).default("centre d'appels"),
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        logger.info({ businessType: input.businessType }, "[ServicecallV3] Generating summary");
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
          model: AI_MODEL.DEFAULT,
          messages: [
            { role: "system", content: SUMMARY_SYSTEM_PROMPT(input.businessType) },
            { role: "user", content: `Transcript de l'entretien :\n\n${input.transcript}` },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        });
        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content);
        logger.info({ decision: result.decisionRecommendation }, "[ServicecallV3] Summary generated");
        return result;
      } catch (error: any) {
        logger.error({ error }, "[ServicecallV3] Failed to generate summary");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de générer le résumé",
          cause: error,
        });
      }
    }),

  /**
   * MODULE 3 — Qualification Appels Entrants
   * Extrait nom/entreprise/coordonnées, détermine intent, urgence, transfert
   * Température : 0.3 (extraction précise)
   */
  qualifyCall: tenantProcedure
    .input(
      z.object({
        transcription: z.string().min(10, "La transcription doit contenir au moins 10 caractères"),
        businessType: z.string().min(1).default("centre d'appels"),
        departments: z.array(z.string()).default(["Commercial", "Support", "Administratif"]),
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        logger.info({ businessType: input.businessType }, "[ServicecallV3] Qualifying call");
        const openai = getOpenAIClient();
        const response = await openai.chat.completions.create({
          model: AI_MODEL.DEFAULT,
          messages: [
            {
              role: "system",
              content: CALL_QUALIFICATION_PROMPT(input.businessType, input.departments),
            },
            {
              role: "user",
              content: `Transcription de l'appel entrant :\n\n${input.transcription}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        });
        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content);
        logger.info({ urgency: result.urgency, intent: result.callIntent }, "[ServicecallV3] Call qualified");
        return result;
      } catch (error: any) {
        logger.error({ error }, "[ServicecallV3] Failed to qualify call");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de qualifier l'appel",
          cause: error,
        });
      }
    }),

  /**
   * MODULE 4 — Parsing CV / Mails de Candidature
   * Extraction automatisée : nom, email, téléphone, poste, expérience, compétences, formation
   * Température : 0.3 (extraction précise)
   */
  parseDocument: tenantProcedure
    .input(
      z.object({
        content: z.string().min(30, "Le contenu doit contenir au moins 30 caractères"),
        documentType: z.enum(["cv", "mail"]).default("cv"),
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        logger.info({ documentType: input.documentType }, "[ServicecallV3] Parsing document");
        const openai = getOpenAIClient();
        const systemPrompt = input.documentType === "cv" ? CV_PARSING_PROMPT : MAIL_PARSING_PROMPT;
        const response = await openai.chat.completions.create({
          model: AI_MODEL.DEFAULT,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Contenu du ${input.documentType === "cv" ? "CV" : "mail de candidature"} :\n\n${input.content}`,
            },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        });
        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content);
        logger.info({ documentType: input.documentType }, "[ServicecallV3] Document parsed");
        return result;
      } catch (error: any) {
        logger.error({ error }, "[ServicecallV3] Failed to parse document");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible de parser le document",
          cause: error,
        });
      }
    }),

  /**
   * Analyse complète combinée (entretien + résumé en un seul appel)
   * Optimisé pour réduire la latence
   */
  fullAnalysis: tenantProcedure
    .input(
      z.object({
        transcript: z.string().min(50),
        businessType: z.string().min(1).default("centre d'appels"),
      })
    )
    .mutation(async ({ input }: any) => {
      try {
        logger.info({ businessType: input.businessType }, "[ServicecallV3] Full analysis started");
        const openai = getOpenAIClient();

        const FULL_PROMPT = `Tu es l'Intelligence Centrale de Servicall v2.
Secteur : "${input.businessType}".

Effectue une analyse complète de l'entretien et génère :
1. L'analyse détaillée (scores, behavioral, red flags, strengths)
2. Le résumé décisionnel (profil, point fort, risque, décision)

Réponds UNIQUEMENT en JSON valide :
{
  "analysis": {
    "criteriaScores": {
      "technical": { "score": 7.5, "comment": "...", "weight": 1.5 },
      "communication": { "score": 8.0, "comment": "...", "weight": 1.2 },
      "coherence": { "score": 6.5, "comment": "...", "weight": 1.3 },
      "honesty": { "score": 7.0, "comment": "...", "weight": 1.4 },
      "motivation": { "score": 8.5, "comment": "...", "weight": 1.1 }
    },
    "behavioralAnalysis": {
      "emotions": ["confident"],
      "emotionTimeline": [{ "timestamp": 30, "emotion": "nervous", "intensity": 0.6 }],
      "coherenceScore": 7.5,
      "honestyScore": 8.0,
      "communicationScore": 8.5
    },
    "redFlags": [],
    "strengths": [],
    "globalScore": 7.5
  },
  "summary": {
    "globalProfile": "...",
    "differentiatingStrength": "...",
    "majorRiskOrRecommendation": "...",
    "decisionRecommendation": "RECRUTER",
    "confidence": 0.85
  }
}
100% Français. JSON strict.`;

        const response = await openai.chat.completions.create({
          model: AI_MODEL.DEFAULT,
          messages: [
            { role: "system", content: FULL_PROMPT },
            { role: "user", content: `Transcript :\n\n${input.transcript}` },
          ],
          temperature: 0.4,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const result = JSON.parse(content);
        logger.info({ decision: result.summary?.decisionRecommendation }, "[ServicecallV3] Full analysis completed");
        return result;
      } catch (error: any) {
        logger.error({ error }, "[ServicecallV3] Full analysis failed");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Impossible d'effectuer l'analyse complète",
          cause: error,
        });
      }
    }),
});