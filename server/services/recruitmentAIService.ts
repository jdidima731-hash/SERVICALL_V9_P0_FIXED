/**
 * Recruitment AI Service
 * Pipeline de recrutement complet avec analyse CV et scoring
 * ✅ PHASE 8 — Recrutement IA
 */

import { logger } from "../infrastructure/logger";
import { chatCompletionWithRetry } from "./openaiRetryService";

export interface CVAnalysis {
  candidateId: number;
  score: number; // 0-100
  skills: string[];
  experience: string;
  education: string;
  strengths: string[];
  weaknesses: string[];
  recommendation: "strong_match" | "good_match" | "weak_match";
}

export interface InterviewSimulation {
  candidateId: number;
  question: string;
  expectedAnswer: string;
  evaluationCriteria: string[];
  difficulty: "easy" | "medium" | "hard";
}

export interface InterviewResult {
  candidateId: number;
  interviewId: number;
  score: number; // 0-100
  answers: Array<{
    question: string;
    answer: string;
    score: number;
    feedback: string;
  }>;
  overallFeedback: string;
  recommendation: "hire" | "maybe" | "reject";
}

/**
 * Service de Recrutement IA
 */
export class RecruitmentAIService {
  /**
   * Analyse un CV et génère un score
   */
  async analyzeCV(candidateId: number, cvContent: string): Promise<CVAnalysis> {
    try {
      logger.info("[Recruitment AI] Analyzing CV", { candidateId });

      const analysisPrompt = `Analyse ce CV et fournis une évaluation structurée:\n\n${cvContent}\n\nFournis la réponse en JSON avec les champs: score (0-100), skills (array), experience (string), education (string), strengths (array), weaknesses (array), recommendation (strong_match|good_match|weak_match)`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: analysisPrompt }],
        "gpt-4o-mini"
      );

      const analysisText = (response.choices?.[0]?.message?.content as string) || "{}";
      let analysis: any = {};
      try {
        analysis = JSON.parse(analysisText);
      } catch {
        logger.warn("[Recruitment AI] CV analysis response was not valid JSON, using defaults", { candidateId });
      }

      const cvAnalysis: CVAnalysis = {
        candidateId,
        score: typeof analysis.score === 'number' ? analysis.score : 50,
        skills: Array.isArray(analysis.skills) ? analysis.skills : [],
        experience: typeof analysis.experience === 'string' ? analysis.experience : "Non disponible",
        education: typeof analysis.education === 'string' ? analysis.education : "Non disponible",
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
        recommendation: (analysis.recommendation === "strong_match" || analysis.recommendation === "good_match" || analysis.recommendation === "weak_match") 
          ? analysis.recommendation 
          : "weak_match",
      };

      logger.info("[Recruitment AI] CV analyzed", { candidateId, score: cvAnalysis.score });

      return cvAnalysis;
    } catch (error: any) {
      logger.error("[Recruitment AI] Error analyzing CV", { error, candidateId });
      throw error;
    }
  }

  /**
   * Génère une question d'entretien
   */
  async generateInterviewQuestion(
    candidateId: number,
    difficulty: "easy" | "medium" | "hard" = "medium"
  ): Promise<InterviewSimulation> {
    try {
      logger.info("[Recruitment AI] Generating interview question", { candidateId, difficulty });

      const prompt = `Génère une question d'entretien d'embauche de difficulté ${difficulty} pour évaluer les compétences professionnelles.\n\nFournis la réponse en JSON avec les champs: question (string), expectedAnswer (string), evaluationCriteria (array de 3-4 critères)`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: prompt }],
        "gpt-4o-mini"
      );

      const questionText = (response.choices?.[0]?.message?.content as string) || "{}";
      let questionData: any = {};
      try {
        questionData = JSON.parse(questionText);
      } catch {
        logger.warn("[Recruitment AI] Interview question response was not valid JSON, using defaults", { candidateId });
      }

      const simulation: InterviewSimulation = {
        candidateId,
        question: typeof questionData.question === 'string' ? questionData.question : "Parlez de votre expérience professionnelle",
        expectedAnswer: typeof questionData.expectedAnswer === 'string' ? questionData.expectedAnswer : "Réponse attendue",
        evaluationCriteria: Array.isArray(questionData.evaluationCriteria) ? questionData.evaluationCriteria : ["Clarté", "Pertinence", "Concision"],
        difficulty,
      };

      logger.info("[Recruitment AI] Interview question generated", { candidateId });

      return simulation;
    } catch (error: any) {
      logger.error("[Recruitment AI] Error generating interview question", { error, candidateId });
      throw error;
    }
  }

  /**
   * Évalue la réponse à une question d'entretien
   */
  async evaluateAnswer(
    candidateId: number,
    question: string,
    answer: string,
    evaluationCriteria: string[]
  ): Promise<{
    score: number;
    feedback: string;
  }> {
    try {
      logger.info("[Recruitment AI] Evaluating answer", { candidateId });

      const prompt = `Évalue cette réponse d'entretien sur une échelle de 0-100 selon les critères suivants:\n\nQuestion: ${question}\nRéponse du candidat: ${answer}\nCritères d'évaluation: ${evaluationCriteria.join(", ")}\n\nFournis la réponse en JSON avec les champs: score (0-100), feedback (string avec suggestions d'amélioration)`;

      const response = await chatCompletionWithRetry(
        [{ role: "user", content: prompt }],
        "gpt-4o-mini"
      );

      const evaluationText = (response.choices?.[0]?.message?.content as string) || "{}";
      let evaluation: any = {};
      try {
        evaluation = JSON.parse(evaluationText);
      } catch {
        logger.warn("[Recruitment AI] Evaluation response was not valid JSON, using defaults", { candidateId });
      }

      return {
        score: typeof evaluation.score === 'number' ? evaluation.score : 50,
        feedback: typeof evaluation.feedback === 'string' ? evaluation.feedback : "Aucun retour disponible",
      };
    } catch (error: any) {
      logger.error("[Recruitment AI] Error evaluating answer", { error, candidateId });
      throw error;
    }
  }

  /**
   * Détermine la recommandation d'embauche
   */
  private _getHiringRecommendation(score: number): "hire" | "maybe" | "reject" {
    if (score >= 75) return "hire";
    if (score >= 50) return "maybe";
    return "reject";
  }
}

/**
 * Instance singleton du service de Recrutement IA
 */
export const recruitmentAIService = new RecruitmentAIService();
