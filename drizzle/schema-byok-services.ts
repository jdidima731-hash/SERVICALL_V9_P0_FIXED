/**
 * BYOK (Bring Your Own Key) & 10 Services Métier
 * Architecture centralisée pour les clés API et les services avancés
 */

import { pgTable, integer, varchar, text, timestamp, json, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import type { WebhookPayload } from "../shared/validation/jsonb-critical";
import { relations } from "drizzle-orm";

// ============================================
// BYOK: API Keys Management (Centralized)
// ============================================
export const apiKeys = pgTable(
  "api_keys",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    provider: varchar("provider", { length: 100 }).notNull(), // 'google_maps', 'pages_jaunes', 'openai', 'stripe', 'sendgrid', etc.
    encryptedKey: text("encrypted_key").notNull(), // Clé chiffrée AES-256-GCM (Format: iv:authTag:encrypted)
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantProviderIdx: uniqueIndex("api_keys_tenant_provider_idx").on(table.tenantId, table.provider),
    tenantIdIdx: index("api_keys_tenant_id_idx").on(table.tenantId),
  })
);

export type APIKey = typeof apiKeys.$inferSelect;
export type InsertAPIKey = typeof apiKeys.$inferInsert;

// ============================================
// BYOK: Audit Log
// ============================================
export const byokAuditLogs = pgTable(
  "byok_audit_logs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    action: varchar("action", { length: 50 }).notNull(), // 'create', 'update', 'delete', 'test'
    provider: varchar("provider", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(), // 'success', 'failed'
    message: text("message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("byok_audit_logs_tenant_id_idx").on(table.tenantId),
    createdAtIdx: index("byok_audit_logs_created_at_idx").on(table.createdAt),
  })
);

export type BYOKAuditLog = typeof byokAuditLogs.$inferSelect;
export type InsertBYOKAuditLog = typeof byokAuditLogs.$inferInsert;

// ============================================
// SERVICE 1: Leads Management
// ============================================
export const leads = pgTable(
  "leads",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    company: varchar("company", { length: 255 }),
    industry: varchar("industry", { length: 100 }),
    source: varchar("source", { length: 50 }), // 'google_maps', 'pages_jaunes', 'manual', 'csv'
    sourceData: json("source_data"),
    enrichmentStatus: varchar("enrichment_status", { length: 50 }).default("pending"), // 'pending', 'enriched', 'failed'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("leads_tenant_id_idx").on(table.tenantId),
    emailIdx: index("leads_email_idx").on(table.email),
    createdAtIdx: index("leads_created_at_idx").on(table.createdAt),
  })
);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ============================================
// SERVICE 2: Contact Memory (AI)
// ============================================
export const contactMemories = pgTable(
  "contact_memories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    contactId: integer("contact_id").notNull(),
    interactionType: varchar("interaction_type", { length: 50 }).notNull(), // 'call', 'email', 'meeting'
    summary: text("summary").notNull(),
    sentiment: varchar("sentiment", { length: 20 }), // 'positive', 'neutral', 'negative'
    keyPoints: json("key_points"), // Array of key discussion points
    nextActions: json("next_actions"), // Array of recommended next steps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("contact_memories_tenant_id_idx").on(table.tenantId),
    contactIdIdx: index("contact_memories_contact_id_idx").on(table.contactId),
    createdAtIdx: index("contact_memories_created_at_idx").on(table.createdAt),
  })
);

export type ContactMemory = typeof contactMemories.$inferSelect;
export type InsertContactMemory = typeof contactMemories.$inferInsert;

// ============================================
// SERVICE 3: Workflow Builder (BYOK visual builder)
// ============================================
export const byokWorkflows = pgTable(
  "byok_workflows",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    definition: json("definition").notNull(), // Visual workflow definition
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("byok_workflows_tenant_id_idx").on(table.tenantId),
  })
);

export type ByokWorkflow = typeof byokWorkflows.$inferSelect;
export type InsertByokWorkflow = typeof byokWorkflows.$inferInsert;

// ============================================
// SERVICE 4: Weekly Reports
// ============================================
export const reports = pgTable(
  "reports",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    reportType: varchar("report_type", { length: 50 }).notNull(), // 'weekly', 'monthly', 'custom'
    htmlContent: text("html_content").notNull(),
    sentTo: varchar("sent_to", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("reports_tenant_id_idx").on(table.tenantId),
    createdAtIdx: index("reports_created_at_idx").on(table.createdAt),
  })
);

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ============================================
// SERVICE 5: Webhook Subscriptions
// ============================================
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    events: json("events").notNull(), // Array of event types
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("webhook_subscriptions_tenant_id_idx").on(table.tenantId),
  })
);

export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type InsertWebhookSubscription = typeof webhookSubscriptions.$inferInsert;

// ============================================
// SERVICE 5: Webhook Deliveries (Audit)
// ============================================
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    subscriptionId: integer("subscription_id").notNull(),
    event: varchar("event", { length: 100 }).notNull(),
    payload: json("payload").$type<WebhookPayload>().notNull(),
    statusCode: integer("status_code"),
    response: text("response"),
    retryCount: integer("retry_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    subscriptionIdIdx: index("webhook_deliveries_subscription_id_idx").on(table.subscriptionId),
    createdAtIdx: index("webhook_deliveries_created_at_idx").on(table.createdAt),
  })
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;

// ✅ FIX P0: Table 'blueprints' supprimée. 
// La source de vérité unique est désormais shared/blueprints.json via BlueprintCatalogService.

// ============================================
// SERVICE 7: Email Configuration
// ============================================
export const emailConfigs = pgTable(
  "email_configs",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    provider: varchar("provider", { length: 50 }).notNull(), // 'sendgrid', 'gmail', 'outlook'
    encryptedCredentials: text("encrypted_credentials").notNull(),
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("email_configs_tenant_id_idx").on(table.tenantId),
  })
);

export type EmailConfig = typeof emailConfigs.$inferSelect;
export type InsertEmailConfig = typeof emailConfigs.$inferInsert;

// ============================================
// SERVICE 8: AI Metrics & Monitoring
// ============================================
export const aiMetrics = pgTable(
  "ai_metrics",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    tokensUsed: integer("tokens_used").default(0),
    latencyMs: integer("latency_ms"),
    status: varchar("status", { length: 20 }), // 'success', 'error'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("ai_metrics_tenant_id_idx").on(table.tenantId),
  })
);

export type AIMetric = typeof aiMetrics.$inferSelect;
export type InsertAIMetric = typeof aiMetrics.$inferInsert;

// ============================================
// SERVICE 9: Custom Fields (Dynamic CRM)
// ============================================
export const customFields = pgTable(
  "custom_fields",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // 'prospect', 'call', 'user'
    fieldName: varchar("field_name", { length: 100 }).notNull(),
    fieldType: varchar("field_type", { length: 50 }).notNull(), // 'text', 'number', 'date', 'select'
    options: json("options"), // For select type
    isRequired: boolean("is_required").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantEntityIdx: index("custom_fields_tenant_entity_idx").on(table.tenantId, table.entityType),
  })
);

export type CustomField = typeof customFields.$inferSelect;
export type InsertCustomField = typeof customFields.$inferInsert;

// ============================================
// SERVICE 10: Usage Quotas
// ============================================
export const usageQuotas = pgTable(
  "usage_quotas",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id").notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(), // 'calls', 'ai_tokens', 'storage'
    limit: integer("limit").notNull(),
    currentUsage: integer("current_usage").default(0).notNull(),
    resetPeriod: varchar("reset_period", { length: 20 }).default("monthly"), // 'daily', 'monthly', 'never'
    lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantResourceIdx: uniqueIndex("usage_quotas_tenant_resource_idx").on(table.tenantId, table.resourceType),
  })
);

export type UsageQuota = typeof usageQuotas.$inferSelect;
export type InsertUsageQuota = typeof usageQuotas.$inferInsert;

// ============================================
// RELATIONS
// ============================================
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  // Relation avec les logs d'audit (via tenantId pour la visibilité globale)
}));

export const webhookSubscriptionsRelations = relations(webhookSubscriptions, ({ many }) => ({
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  subscription: one(webhookSubscriptions, {
    fields: [webhookDeliveries.subscriptionId],
    references: [webhookSubscriptions.id],
  }),
}));
