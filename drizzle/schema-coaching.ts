/**
 * SCHEMA — Domaine Coaching & Performance
 * Tables : coachingFeedback, agentPerformance, trainingModules
 */
import { pgTable, varchar, integer, timestamp, text, json, decimal, index } from "drizzle-orm/pg-core";
import { tenants, users, calls } from "./schema";

// ============================================
// COACHING_FEEDBACK TABLE
// ============================================
export const coachingFeedback = pgTable("coaching_feedback", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  callId: integer("call_id").references(() => calls.id, { onDelete: "set null" }),
  coachId: integer("coach_id").references(() => users.id, { onDelete: "set null" }),
  feedback: text("feedback").notNull(),
  rating: integer("rating"), // 1-5
  strengths: json("strengths"),
  improvements: json("improvements"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_coaching_feedback_tenant_id_idx").on(table.tenantId),
  agentIdIdx: index("idx_coaching_feedback_agent_id_idx").on(table.agentId),
  callIdIdx: index("idx_coaching_feedback_call_id_idx").on(table.callId),
}));

export type CoachingFeedback = typeof coachingFeedback.$inferSelect;
export type InsertCoachingFeedback = typeof coachingFeedback.$inferInsert;

// ============================================
// AGENT_PERFORMANCE TABLE
// ============================================
export const agentPerformance = pgTable("agent_performance", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  agentId: integer("agent_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull(), // 'daily', 'weekly', 'monthly'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  averageDuration: integer("average_duration"),
  averageScore: decimal("average_score", { precision: 3, scale: 2 }),
  metrics: json("metrics"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_agent_performance_tenant_id_idx").on(table.tenantId),
  agentIdIdx: index("idx_agent_performance_agent_id_idx").on(table.agentId),
  periodIdx: index("idx_agent_performance_period_idx").on(table.period),
  periodStartIdx: index("idx_agent_performance_period_start_idx").on(table.periodStart),
}));

export type AgentPerformance = typeof agentPerformance.$inferSelect;
export type InsertAgentPerformance = typeof agentPerformance.$inferInsert;

// ============================================
// TRAINING_MODULES TABLE
// ============================================
export const trainingModules = pgTable("training_modules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleType: varchar("module_type", { length: 50 }).notNull(),
  progress: integer("progress").default(0).notNull(),
  score: integer("score"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("training_modules_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("training_modules_user_id_idx").on(table.userId),
}));

export type TrainingModule = typeof trainingModules.$inferSelect;
export type InsertTrainingModule = typeof trainingModules.$inferInsert;
