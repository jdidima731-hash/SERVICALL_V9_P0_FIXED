/**
 * SCHEMA — Domaine Tenant
 * Tables : tenantIndustryConfig, tenantAiKeys, workflowTemplates, usageMetrics
 */
import { pgTable, varchar, integer, timestamp, text, boolean, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./schema";
import type { 
  EnabledCapabilities, 
  EnabledWorkflows, 
  WorkflowSteps
} from "../shared/validation/tenant";
import type { AgentSwitchSettings } from "../shared/validation/jsonb-business-config";

// ============================================
// TENANT_INDUSTRY_CONFIG TABLE
// ============================================
export const tenantIndustryConfig = pgTable("tenant_industry_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  industryId: varchar("industry_id", { length: 255 }).notNull(),
  enabledCapabilities: json("enabled_capabilities").$type<EnabledCapabilities>(),
  enabledWorkflows: json("enabled_workflows").$type<EnabledWorkflows>(),
  aiSystemPrompt: text("ai_system_prompt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: uniqueIndex("idx_tenant_industry_config_tenant_id_unique").on(table.tenantId),
}));

export type TenantIndustryConfig = typeof tenantIndustryConfig.$inferSelect;
export type InsertTenantIndustryConfig = typeof tenantIndustryConfig.$inferInsert;

// ============================================
// TENANT_AI_KEYS TABLE (Encrypted Storage - BYOK)
// ============================================
export const tenantAiKeys = pgTable("tenant_ai_keys", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 50 }).notNull().default("openai"),
  encryptedKey: text("encrypted_key").notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true),
  lastValidatedAt: timestamp("last_validated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: uniqueIndex("idx_tenant_ai_keys_tenant_id_unique").on(table.tenantId),
  providerIdx: index("idx_tenant_ai_keys_provider_idx").on(table.provider),
}));

export type TenantAiKey = typeof tenantAiKeys.$inferSelect;
export type InsertTenantAiKey = typeof tenantAiKeys.$inferInsert;

// ============================================
// WORKFLOW_TEMPLATES TABLE
// ============================================
export const workflowTemplates = pgTable("workflow_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  industryId: varchar("industry_id", { length: 255 }).notNull(),
  templateId: varchar("template_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerType: varchar("trigger_type", { length: 50 }),
  steps: json("steps").notNull().$type<WorkflowSteps>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueTemplate: uniqueIndex("unique_template_idx").on(table.industryId, table.templateId),
  industryIdIdx: index("idx_workflow_templates_industry_id_idx").on(table.industryId),
}));

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

// ============================================
// USAGE_METRICS TABLE
// ============================================
export const usageMetrics = pgTable("usage_metrics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  metricType: varchar("metric_type", { length: 100 }).notNull(),
  value: integer("value").default(0),
  period: varchar("period", { length: 50 }),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_usage_metrics_tenant_id_idx").on(table.tenantId),
  metricTypeIdx: index("idx_usage_metrics_metric_type_idx").on(table.metricType),
}));

export type UsageMetric = typeof usageMetrics.$inferSelect;
export type InsertUsageMetric = typeof usageMetrics.$inferInsert;

// ============================================
// TENANT_SETTINGS TABLE
// ============================================
export const tenantSettings = pgTable("tenant_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().unique().references(() => tenants.id, { onDelete: "cascade" }),
  aiAutomationRate: integer("ai_automation_rate").default(80),
  escalationThreshold: integer("escalation_threshold").default(50),
  agentSwitchSettings: json("agent_switch_settings").$type<AgentSwitchSettings>(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: uniqueIndex("idx_tenant_settings_tenant_id_unique").on(table.tenantId),
}));

export type TenantSetting = typeof tenantSettings.$inferSelect;
export type InsertTenantSetting = typeof tenantSettings.$inferInsert;

// ============================================
// RELATIONS
// ============================================
export const tenantIndustryConfigRelations = relations(tenantIndustryConfig, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantIndustryConfig.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantAiKeysRelations = relations(tenantAiKeys, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantAiKeys.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantSettingsRelations = relations(tenantSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantSettings.tenantId],
    references: [tenants.id],
  }),
}));
