/**
 * SCHEMA — Domaine IA
 * Tables : auditAiUsage, aiSuggestions, aiMemories, predictiveScores
 */
import { pgTable, varchar, integer, timestamp, text, boolean, json, decimal, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants, prospects } from "./schema";
import type { KeyFacts, RiskFactors, PredictiveFactors, AIMetadata } from "../shared/validation/ai";

// ============================================
// AUDIT_AI_USAGE TABLE
// ============================================
export const auditAiUsage = pgTable("audit_ai_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workflowId: integer("workflow_id"),
  model: varchar("model", { length: 100 }),
  tokensUsed: integer("tokens_used"),
  cost: decimal("cost", { precision: 10, scale: 6 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_audit_ai_usage_tenant_id_idx").on(table.tenantId),
  createdAtIdx: index("idx_audit_ai_usage_created_at_idx").on(table.createdAt),
}));

export type AuditAiUsage = typeof auditAiUsage.$inferSelect;
export type InsertAuditAiUsage = typeof auditAiUsage.$inferInsert;

// ============================================
// AI_SUGGESTIONS TABLE
// ============================================
export const aiSuggestions = pgTable("ai_suggestions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  type: varchar("type", { length: 50 }).notNull(), // 'upsell', 'retention', 'followup'
  content: text("content").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_ai_suggestions_tenant_id_idx").on(table.tenantId),
}));

export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = typeof aiSuggestions.$inferInsert;

// ============================================
// AI_MEMORIES TABLE — Mémoire conversationnelle longue durée
// ============================================
export const aiMemories = pgTable("ai_memories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull(),
  contactIdentifier: text("contact_identifier").notNull(), // phone, email, ou prospectId
  contactName: text("contact_name"),
  channel: varchar("channel", { length: 20 }).notNull().default("call"), // call|whatsapp|sms|email|chat
  summary: text("summary").notNull(),
  keyFacts: json("key_facts").$type<KeyFacts>().default({}),
  interactionDate: timestamp("interaction_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  lookupIdx: index("idx_ai_memories_lookup").on(table.tenantId, table.contactIdentifier, table.interactionDate),
}));

export type AiMemory = typeof aiMemories.$inferSelect;
export type InsertAiMemory = typeof aiMemories.$inferInsert;

// ============================================
// PREDICTIVE_SCORES TABLE
// ============================================
export const predictiveScores = pgTable("predictive_scores", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id"),
  scoreType: varchar("score_type", { length: 100 }).notNull().default("payment_prediction"),
  score: decimal("score", { precision: 5, scale: 4 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  probabilityAcceptance: decimal("probability_acceptance", { precision: 5, scale: 4 }),
  estimatedPaymentDelay: integer("estimated_payment_delay"),
  estimatedProcessingTime: integer("estimated_processing_time"),
  recommendedChannel: varchar("recommended_channel", { length: 100 }),
  recommendedTime: varchar("recommended_time", { length: 100 }),
  successProbability: decimal("success_probability", { precision: 5, scale: 4 }),
  riskFactors: json("risk_factors").$type<RiskFactors>(),
  factors: json("factors").$type<PredictiveFactors>(),
  metadata: json("metadata").$type<AIMetadata>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_predictive_scores_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_predictive_scores_prospect_id_idx").on(table.prospectId),
  scoreTypeIdx: index("idx_predictive_scores_score_type_idx").on(table.scoreType),
}));

export type PredictiveScore = typeof predictiveScores.$inferSelect;
export type InsertPredictiveScore = typeof predictiveScores.$inferInsert;

// ============================================
// RELATIONS
// ============================================
export const auditAiUsageRelations = relations(auditAiUsage, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditAiUsage.tenantId],
    references: [tenants.id],
  }),
}));

// ============================================
// AI_ROLES TABLE — Persistance des rôles IA (Axe 2)
// ============================================
export const aiRoles = pgTable("ai_roles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(),
  model: varchar("model", { length: 100 }).default("gpt-4"),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.7"),
  isActive: boolean("is_active").default(true),
  // ── Voix & audio ──────────────────────────────────────────────────────────
  ttsVoice: varchar("tts_voice", { length: 50 }).default("alloy"),    // alloy|echo|fable|onyx|nova|shimmer
  ttsSpeed: decimal("tts_speed", { precision: 3, scale: 2 }).default("1.00"), // 0.25 – 4.0
  ttsPitch: decimal("tts_pitch", { precision: 3, scale: 2 }).default("1.00"), // 0.5 – 2.0 (utilisé comme paramètre EQ futur)
  ttsLanguage: varchar("tts_language", { length: 10 }).default("fr"),  // fr|en|es|de|ar
  // ── Messages personnalisés ─────────────────────────────────────────────────
  greetingMessage: text("greeting_message").default("Bonjour, je suis votre assistant Servicall. Comment puis-je vous aider ?"),
  farewellMessage: text("farewell_message").default("Merci pour votre appel. Bonne journée !"),
  holdMessage: text("hold_message").default("Veuillez patienter, je recherche l'information pour vous."),
  transferMessage: text("transfer_message").default("Je vous transfère vers un conseiller. Restez en ligne."),
  // ── Comportement ──────────────────────────────────────────────────────────
  metadata: json("metadata").$type<AIMetadata>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_ai_roles_tenant_id_idx").on(table.tenantId),
}));

export type AiRole = typeof aiRoles.$inferSelect;
export type InsertAiRole = typeof aiRoles.$inferInsert;
