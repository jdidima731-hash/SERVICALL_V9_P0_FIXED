import { pgTable, integer, varchar, text, timestamp, json, boolean, index, uniqueIndex, decimal } from "drizzle-orm/pg-core";
import { tenants } from "./schema";
import { pgEnum } from "drizzle-orm/pg-core";
import type { AIGeneratedProfile } from "../shared/validation/jsonb-critical";
import type { 
  CVParsedData, 
  MatchingDetails, 
  InterviewAnalysis, 
  ConversationHistory 
} from "../shared/validation/jsonb-history-analysis";

// ============================================
// ENUMS pour le module de recrutement
// ============================================
export const interviewStatusEnum = pgEnum("interview_status", [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "reviewed",
  "shortlisted",
  "rejected",
  "cancelled"
]);

export const candidateSourceEnum = pgEnum("candidate_source", [
  "platform",
  "manual",
  "referral",
  "job_board",
  "other"
]);

export const emotionEnum = pgEnum("emotion", [
  "confident",
  "nervous",
  "calm",
  "stressed",
  "enthusiastic",
  "neutral",
  "defensive",
  "uncertain"
]);

// ============================================
// TABLE: candidate_interviews
// Stocke tous les entretiens IA des candidats
// ============================================
export const candidateInterviews = pgTable("candidate_interviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  
  // Informations candidat (chiffrées pour RGPD)
  candidateName: text("candidate_name"), // Encrypted
  candidateEmail: text("candidate_email"), // Encrypted
  candidatePhone: text("candidate_phone"), // Encrypted
  
  // Métier et configuration
  businessType: varchar("business_type", { length: 100 }).notNull(), // ex: "medical_secretary", "restaurant_server"
  jobPosition: varchar("job_position", { length: 255 }).notNull(), // Poste exact
  
  // Lien vers l'offre d'emploi
  jobOfferId: integer("job_offer_id"),
  
  // CV du candidat
  cvUrl: text("cv_url"),
  cvFileName: varchar("cv_file_name", { length: 255 }),
  cvParsedData: json("cv_parsed_data").$type<CVParsedData>(),
  
  // Score de matching IA avec l'offre
  matchingScore: decimal("matching_score", { precision: 5, scale: 2 }),
  matchingDetails: json("matching_details").$type<MatchingDetails>(),
  
  // Envoi au client
  sentToClient: boolean("sent_to_client").default(false),
  sentToClientAt: timestamp("sent_to_client_at"),
  clientFeedback: text("client_feedback"),
  clientDecision: varchar("client_decision", { length: 50 }),
  
  // Planification et exécution
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // Durée en secondes
  
  // Statut et source
  status: interviewStatusEnum("status").default("pending"),
  source: candidateSourceEnum("source").default("platform"),
  
  // Données d'appel
  callSid: varchar("call_sid", { length: 255 }), // SID Twilio
  recordingUrl: text("recording_url"),
  
  // Transcript et analyse
  transcript: text("transcript"), // Transcript complet de l'entretien
  
  // Scores et notes (JSON structuré)
  notesJson: json("notes_json").$type<InterviewAnalysis>(),
  
  // Résumé et recommandation
  aiSummary: text("ai_summary"), // Résumé généré par l'IA
  aiRecommendation: varchar("ai_recommendation", { length: 50 }), // "hire", "maybe", "reject"
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }), // Niveau de confiance 0-100
  
  // Métadonnées
  metadata: json("metadata"), // Données supplémentaires flexibles
  
  // Notes employeur
  employerNotes: text("employer_notes"),
  employerDecision: varchar("employer_decision", { length: 50 }), // "hired", "rejected", "pending"
  employerDecisionAt: timestamp("employer_decision_at"),
  
  // Conformité RGPD
  consentGiven: boolean("consent_given").default(false),
  dataRetentionUntil: timestamp("data_retention_until"),
  anonymized: boolean("anonymized").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index pour performance multi-tenant
  tenantIdIdx: index("candidate_interviews_tenant_id_idx").on(table.tenantId),
  tenantBusinessIdx: index("candidate_interviews_tenant_business_idx").on(table.tenantId, table.businessType),
  tenantStatusIdx: index("candidate_interviews_tenant_status_idx").on(table.tenantId, table.status),
  statusIdx: index("candidate_interviews_status_idx").on(table.status),
  businessTypeIdx: index("candidate_interviews_business_type_idx").on(table.businessType),
  scheduledAtIdx: index("candidate_interviews_scheduled_at_idx").on(table.scheduledAt),
  createdAtIdx: index("candidate_interviews_created_at_idx").on(table.createdAt.desc()),
  
  // Index composite pour filtrage avancé
  tenantBusinessStatusIdx: index("candidate_interviews_tenant_business_status_idx")
    .on(table.tenantId, table.businessType, table.status),
  
  // Index unique pour call_sid
  callSidIdx: uniqueIndex("candidate_interviews_call_sid_idx").on(table.callSid),
}));

export type CandidateInterview = typeof candidateInterviews.$inferSelect;
export type InsertCandidateInterview = typeof candidateInterviews.$inferInsert;

// ============================================
// TABLE: interview_questions
// Stocke les questions métier configurables
// ============================================
export const interviewQuestions = pgTable("interview_questions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }), // null = question universelle
  
  businessType: varchar("business_type", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // "technical", "behavioral", "situational"
  
  question: text("question").notNull(),
  expectedAnswerType: varchar("expected_answer_type", { length: 50 }), // "open", "yes_no", "numeric", "choice"
  expectedKeywords: json("expected_keywords").$type<string[]>(), // Mots-clés attendus
  
  weight: decimal("weight", { precision: 5, scale: 2 }).default("1.00"), // Poids de la question
  isActive: boolean("is_active").default(true),
  
  // Ordre d'affichage
  order: integer("order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  businessTypeIdx: index("interview_questions_business_type_idx").on(table.businessType),
  tenantBusinessIdx: index("interview_questions_tenant_business_idx").on(table.tenantId, table.businessType),
  isActiveIdx: index("interview_questions_is_active_idx").on(table.isActive),
}));

export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type InsertInterviewQuestion = typeof interviewQuestions.$inferInsert;

// ============================================
// TABLE: recruitment_settings
// Configuration du recrutement par tenant
// ============================================
export const recruitmentSettings = pgTable("recruitment_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  
  businessType: varchar("business_type", { length: 100 }).notNull(),
  
  // Scores minimaux acceptés
  minGlobalScore: decimal("min_global_score", { precision: 5, scale: 2 }).default("6.00"),
  minCoherenceScore: decimal("min_coherence_score", { precision: 5, scale: 2 }).default("7.00"),
  minHonestyScore: decimal("min_honesty_score", { precision: 5, scale: 2 }).default("7.00"),
  
  // Configuration IA
  aiModel: varchar("ai_model", { length: 100 }).default("gpt-4o-mini"),
  aiTemperature: decimal("ai_temperature", { precision: 3, scale: 2 }).default("0.70"),
  
  // Script personnalisé
  customIntroScript: text("custom_intro_script"),
  customOutroScript: text("custom_outro_script"),
  
  // Notifications
  notifyOnCompletion: boolean("notify_on_completion").default(true),
  notificationEmail: text("notification_email"),
  
  // Rétention des données (jours)
  dataRetentionDays: integer("data_retention_days").default(90),
  
  // Actif/Inactif
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantBusinessUniqueIdx: uniqueIndex("recruitment_settings_tenant_business_unique_idx")
    .on(table.tenantId, table.businessType),
  tenantIdIdx: index("recruitment_settings_tenant_id_idx").on(table.tenantId),
}));

export type RecruitmentSetting = typeof recruitmentSettings.$inferSelect;
export type InsertRecruitmentSetting = typeof recruitmentSettings.$inferInsert;

// ============================================
// TABLE: recruitment_job_requirements
// Exigences client définies via IA
// ============================================
export const recruitmentJobRequirements = pgTable("recruitment_job_requirements", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  jobOfferId: integer("job_offer_id"),
  title: varchar("title", { length: 255 }).notNull(),
  clientRequirementsRaw: text("client_requirements_raw"),
  aiGeneratedProfile: json("ai_generated_profile").$type<AIGeneratedProfile>(),
  conversationHistory: json("conversation_history").$type<ConversationHistory>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("recruitment_job_req_tenant_id_idx").on(table.tenantId),
  isActiveIdx: index("recruitment_job_req_is_active_idx").on(table.isActive),
}));
export type RecruitmentJobRequirement = typeof recruitmentJobRequirements.$inferSelect;
export type InsertRecruitmentJobRequirement = typeof recruitmentJobRequirements.$inferInsert;

// ============================================
// TABLE: recruitment_rdv_slots
// Créneaux de RDV pour les entretiens
// ============================================
export const recruitmentRdvSlots = pgTable("recruitment_rdv_slots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  slotDate: timestamp("slot_date").notNull(),
  slotDuration: integer("slot_duration").default(30),
  isAvailable: boolean("is_available").default(true),
  interviewId: integer("interview_id"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  interviewType: varchar("interview_type", { length: 50 }).default("phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("recruitment_rdv_slots_tenant_id_idx").on(table.tenantId),
  slotDateIdx: index("recruitment_rdv_slots_slot_date_idx").on(table.slotDate),
  isAvailableIdx: index("recruitment_rdv_slots_is_available_idx").on(table.isAvailable),
}));
export type RecruitmentRdvSlot = typeof recruitmentRdvSlots.$inferSelect;
export type InsertRecruitmentRdvSlot = typeof recruitmentRdvSlots.$inferInsert;
