import { pgTable, varchar, integer, timestamp, text, boolean, json, decimal, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { TenantBrandAIConfig, TenantSettings, WorkflowSteps } from "../shared/validation/tenant";
import type { AIMetadata } from "../shared/validation/ai";
import type { WorkflowInput, WorkflowOutput } from "../shared/validation/jsonb-critical";
import type { POSConfig, TriggerConfig } from "../shared/validation/jsonb-business-config";

// Schémas domaine (éclatement de schema-additions.ts — 831 lignes → 7 fichiers)
export * from "./schema-tenant";      // Tenant config, AI keys, workflow templates, usage metrics
export * from "./schema-ai";           // AI usage audit, suggestions, memories, predictive scores
export * from "./schema-calls";        // Recordings, call scoring, simulated calls, agent switch, blacklist
export * from "./schema-compliance";   // Security audit logs, compliance logs/alerts, RGPD consents, 2FA
export * from "./schema-billing";      // Orders, order items, customer invoices
export * from "./schema-messaging";    // Message templates
export * from "./schema-coaching";     // Coaching feedback, agent performance
export * from "./schema-tasks";        // Tasks, appointments, documents, processed events, failed jobs, command validations
export * from "./schema-industries";
export * from "./schema-business";
export * from "./schema-recruitment";
export * from "./schema-deals";
export * from "./schema-social";
export * from "./schema-byok-services";

// ============================================
// WORKFLOW_EXECUTIONS TABLE
// ============================================
export const workflowExecutions = pgTable("workflow_executions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending', 'completed', 'failed'
  trigger: varchar("trigger", { length: 100 }).notNull(),
  input: json("input").$type<WorkflowInput>(),
  output: json("output").$type<WorkflowOutput>(),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workflowIdIdx: index("workflow_executions_workflow_id_idx").on(table.workflowId),
  tenantIdIdx: index("workflow_executions_tenant_id_idx").on(table.tenantId),
  statusIdx: index("workflow_executions_status_idx").on(table.status),
  createdAtIdx: index("workflow_executions_created_at_idx").on(table.createdAt),
}));

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = typeof workflowExecutions.$inferInsert;

// ============================================
// REVOKED_TOKENS TABLE
// ============================================
export const revokedTokens = pgTable("revoked_tokens", {
  jti: varchar("jti", { length: 255 }).primaryKey(),
  exp: timestamp("exp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RevokedToken = typeof revokedTokens.$inferSelect;
export type InsertRevokedToken = typeof revokedTokens.$inferInsert;

// ============================================
// ENUMS
// ============================================
export const roleEnum = pgEnum("role", ["owner", "superadmin", "admin", "manager", "agent", "agentIA", "user"]);

export const token_typeEnum = pgEnum("token_type", ["session", "refresh", "reset_password"]);
export const statusEnum = pgEnum("status", ["new", "contacted", "qualified", "converted", "lost"]);
export const call_typeEnum = pgEnum("call_type", ["inbound", "outbound"]);
export const outcomeEnum = pgEnum("outcome", ["success", "no_answer", "voicemail", "busy", "failed"]);
export const trigger_typeEnum = pgEnum("trigger_type", ["manual", "scheduled", "event"]);
export const planEnum = pgEnum("plan", ["free", "starter", "professional", "enterprise"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "urgent"]);
export const customer_sentimentEnum = pgEnum("customer_sentiment", ["positive", "neutral", "negative"]);
export const typeEnum = pgEnum("type", ["ai_qualification", "human_appointment", "hybrid_reception"]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const resource_typeEnum = pgEnum("resource_type", ["twilio_voice", "twilio_sms", "openai_token"]);
export const reminder_typeEnum = pgEnum("reminder_type", ["email", "sms", "push"]);
export const document_typeEnum = pgEnum("document_type", ["photo", "scan", "contract", "id_card", "other"]);

// ============================================
// USERS TABLE
// ============================================
export const users = pgTable("users", {
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }), // Peut être null pour les superadmins ou utilisateurs sans tenant principal
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  openId: varchar("open_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  loginMethod: varchar("login_method", { length: 50 }),
  role: roleEnum("role").default("user"),
  lastSignedIn: timestamp("last_signed_in"),
  tokensValidAfter: timestamp("tokens_valid_after"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  brandAIConfig: json("brand_ai_config").$type<TenantBrandAIConfig>(),
  whatsappAiLanguage: text("whatsapp_ai_language"),
  whatsappAiTone: text("whatsapp_ai_tone"),
  whatsappAiPersona: text("whatsapp_ai_persona"),
  industry: text("industry"),
  isActive: boolean("is_active").default(true),
  assignedAgentType: varchar("assigned_agent_type", { length: 10 }).default("AI"),
  // Configuration rappels : numéro de téléphone personnel de l'agent pour les rappels
  callbackPhone: varchar("callback_phone", { length: 50 }),
  // 'crm' | 'phone' | 'both'  — canal de notification pour les rappels entrants
  callbackNotifyMode: varchar("callback_notify_mode", { length: 20 }).default("crm"),
  // Disponibilité agent (true = disponible pour transfert humain)
  isAvailableForTransfer: boolean("is_available_for_transfer").default(true),
}, (table) => ({
  tenantIdIdx: index("users_tenant_id_idx").on(table.tenantId),
  emailIdx: index("email_idx").on(table.email),
  openIdIdx: uniqueIndex("open_id_idx").on(table.openId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// TENANTS TABLE
// ============================================
export const tenants = pgTable("tenants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  logo: text("logo"),
  settings: json("settings").$type<TenantSettings>(),
  businessType: varchar("business_type", { length: 50 }),
  aiCustomScript: text("ai_custom_script"),
  posProvider: varchar("pos_provider", { length: 50 }),
  posConfig: json("pos_config").$type<POSConfig>(),
  posSyncEnabled: boolean("pos_sync_enabled").default(false),
  isActive: boolean("is_active").default(true),
  brandAIConfig: json("brand_ai_config").$type<TenantBrandAIConfig>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("slug_idx").on(table.slug),
}));

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ============================================
// TENANT_USERS TABLE (Many-to-Many)
// ============================================
export const tenantUsers = pgTable("tenant_users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantUserUniqueIdx: uniqueIndex("idx_tenant_user_unique").on(table.tenantId, table.userId),
  userIdIdx: index("tenant_users_user_id_idx").on(table.userId),
  tenantIdIdx: index("tenant_users_tenant_id_idx").on(table.tenantId),
}));

export type TenantUser = typeof tenantUsers.$inferSelect;
export type InsertTenantUser = typeof tenantUsers.$inferInsert;

// ============================================
// PROSPECTS TABLE (Leads)
// ============================================
export const prospects = pgTable("prospects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  email: text("email"), // Encrypted
  phone: text("phone"), // Encrypted
  company: varchar("company", { length: 255 }),
  jobTitle: varchar("job_title", { length: 255 }),
  source: varchar("source", { length: 100 }),
  status: statusEnum("status").default("new"),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  priority: varchar("priority", { length: 50 }).default("medium"),
  dueDate: timestamp("due_date"),
  metadata: json("metadata").$type<AIMetadata>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("prospects_tenant_id_idx").on(table.tenantId),
  statusIdx: index("prospects_status_idx").on(table.status),
  assignedToIdx: index("prospects_assigned_to_idx").on(table.assignedTo),
  prospectsLookupIdx: index("idx_prospects_lookup").on(table.tenantId, table.phone),
  tenantCreatedIdx: index("prospects_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
  tenantStatusIdx: index("prospects_tenant_status_idx").on(table.tenantId, table.status),
  tenantUserIdx: index("prospects_tenant_user_idx").on(table.tenantId, table.assignedTo),
}));

export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = typeof prospects.$inferInsert;

// ============================================
// WORKFLOWS TABLE
// ============================================
export const workflows = pgTable("workflows", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  trigger: varchar("trigger", { length: 100 }).notNull(), // 'new_prospect', 'call_ended', etc.
  triggerConfig: json("trigger_config").$type<TriggerConfig>(),
  steps: json("steps").notNull().$type<WorkflowSteps>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("workflows_tenant_id_idx").on(table.tenantId),
  triggerIdx: index("workflows_trigger_idx").on(table.trigger),
}));

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

// ============================================
// CALLS TABLE
// ============================================
export const calls = pgTable("calls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  agentId: integer("agent_id").references(() => users.id, { onDelete: "set null" }),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  callType: call_typeEnum("call_type").default("inbound"),
  status: varchar("status", { length: 50 }).default("pending"),
  duration: integer("duration"),
  recordingUrl: text("recording_url"),
  transcription: text("transcription"),
  summary: text("summary"),
  sentiment: customer_sentimentEnum("sentiment"),
  customerSentiment: customer_sentimentEnum("customer_sentiment"),
  outcome: outcomeEnum("outcome"),
  metadata: json("metadata").$type<AIMetadata>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("calls_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("calls_prospect_id_idx").on(table.prospectId),
  agentIdIdx: index("calls_agent_id_idx").on(table.agentId),
  createdAtIdx: index("calls_created_at_idx").on(table.createdAt),
}));

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

// ============================================
// RELATIONS (Suite)
// ============================================
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  tenantUsers: many(tenantUsers),
  assignedProspects: many(prospects),
  calls: many(calls),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  tenantUsers: many(tenantUsers),
  prospects: many(prospects),
  workflows: many(workflows),
  calls: many(calls),
}));

export const prospectsRelations = relations(prospects, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [prospects.tenantId],
    references: [tenants.id],
  }),
  assignedAgent: one(users, {
    fields: [prospects.assignedTo],
    references: [users.id],
  }),
  calls: many(calls),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [workflows.tenantId],
    references: [tenants.id],
  }),
  executions: many(workflowExecutions),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  tenant: one(tenants, {
    fields: [calls.tenantId],
    references: [tenants.id],
  }),
  prospect: one(prospects, {
    fields: [calls.prospectId],
    references: [prospects.id],
  }),
  agent: one(users, {
    fields: [calls.agentId],
    references: [users.id],
  }),
}));
