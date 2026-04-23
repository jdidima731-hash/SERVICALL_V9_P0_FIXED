/**
 * schema-missing.ts — Tables référencées dans relations.ts mais absentes des autres schemas.
 * Créé lors du P0-6 typecheck fix (V8).
 */
import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { tenants, users, prospects, campaigns, workflows } from "./schema";

// ─── MESSAGES ────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id:          serial("id").primaryKey(),
  tenantId:    integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId:  integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  campaignId:  integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  channel:     text("channel").notNull().default("sms"),
  direction:   text("direction").notNull().default("outbound"),
  content:     text("content").notNull(),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx:   index("idx_messages_tenant_id").on(table.tenantId),
  prospectIdx: index("idx_messages_prospect_id").on(table.prospectId),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id:          serial("id").primaryKey(),
  tenantId:    integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  plan:        text("plan").notNull().default("starter"),
  status:      text("status").notNull().default("active"),
  stripeSubId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd:   timestamp("current_period_end"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_subscriptions_tenant_id").on(table.tenantId),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ─── INVOICES ────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id:             serial("id").primaryKey(),
  tenantId:       integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  amount:         integer("amount").notNull().default(0),
  currency:       text("currency").notNull().default("eur"),
  status:         text("status").notNull().default("draft"),
  stripeInvoiceId: text("stripe_invoice_id"),
  issuedAt:       timestamp("issued_at"),
  paidAt:         timestamp("paid_at"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_invoices_tenant_id").on(table.tenantId),
}));

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id:        serial("id").primaryKey(),
  tenantId:  integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId:    integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action:    text("action").notNull(),
  resource:  text("resource"),
  resourceId: text("resource_id"),
  metadata:  text("metadata"),
  ip:        text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("idx_audit_logs_tenant_id").on(table.tenantId),
  userIdx:   index("idx_audit_logs_user_id").on(table.userId),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── JOBS (workflow queue) ────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id:          serial("id").primaryKey(),
  tenantId:    integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  workflowId:  integer("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
  type:        text("type").notNull(),
  payload:     text("payload"),
  status:      text("status").notNull().default("pending"),
  attempts:    integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledAt: timestamp("scheduled_at"),
  processedAt: timestamp("processed_at"),
  failedAt:    timestamp("failed_at"),
  error:       text("error"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx:   index("idx_jobs_tenant_id").on(table.tenantId),
  statusIdx:   index("idx_jobs_status").on(table.status),
}));

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
