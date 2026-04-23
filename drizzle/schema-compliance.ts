/**
 * SCHEMA — Domaine Compliance & Sécurité
 * Tables : securityAuditLogs, complianceLogs, complianceAlerts, rgpdConsents, user2FA
 */
import { pgTable, varchar, integer, timestamp, text, boolean, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants, users } from "./schema";

// ============================================
// SECURITY_AUDIT_LOGS TABLE
// ============================================
export const securityAuditLogs = pgTable("security_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id"),
  action: varchar("action", { length: 255 }).notNull(),
  resource: varchar("resource", { length: 255 }),
  resourceId: varchar("resource_id", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  status: varchar("status", { length: 50 }).default("success"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_security_audit_logs_tenant_id_idx").on(table.tenantId),
  userIdIdx: index("idx_security_audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("idx_security_audit_logs_action_idx").on(table.action),
  createdAtIdx: index("idx_security_audit_logs_created_at_idx").on(table.createdAt),
}));

export type SecurityAuditLog = typeof securityAuditLogs.$inferSelect;
export type InsertSecurityAuditLog = typeof securityAuditLogs.$inferInsert;

// ============================================
// COMPLIANCE_LOGS TABLE
// ============================================
export const complianceLogs = pgTable("compliance_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  checkType: varchar("check_type", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'compliant', 'warning', 'violation'
  details: json("details"),
  severity: varchar("severity", { length: 50 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_compliance_logs_tenant_id_idx").on(table.tenantId),
  statusIdx: index("idx_compliance_logs_status_idx").on(table.status),
  checkTypeIdx: index("idx_compliance_logs_check_type_idx").on(table.checkType),
}));

export type ComplianceLog = typeof complianceLogs.$inferSelect;
export type InsertComplianceLog = typeof complianceLogs.$inferInsert;

// ============================================
// COMPLIANCE_ALERTS TABLE
// ============================================
export const complianceAlerts = pgTable("compliance_alerts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  alertType: varchar("alert_type", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 50 }).notNull(), // 'low', 'medium', 'high', 'critical'
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"), // 'open', 'acknowledged', 'resolved'
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 255 }),
  metadata: json("metadata"),
  acknowledgedBy: integer("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: integer("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_compliance_alerts_tenant_id_idx").on(table.tenantId),
  severityIdx: index("idx_compliance_alerts_severity_idx").on(table.severity),
  statusIdx: index("idx_compliance_alerts_status_idx").on(table.status),
}));

export type ComplianceAlert = typeof complianceAlerts.$inferSelect;
export type InsertComplianceAlert = typeof complianceAlerts.$inferInsert;

// ============================================
// RGPD_CONSENTS TABLE
// ============================================
export const rgpdConsents = pgTable("rgpd_consents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id"),
  consentType: varchar("consent_type", { length: 100 }).notNull(), // 'marketing', 'data_processing', 'call_recording'
  granted: boolean("granted").default(false),
  grantedAt: timestamp("granted_at"),
  resolvedAt: timestamp("resolved_at"),
  metadata: json("metadata"),
  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_rgpd_consents_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_rgpd_consents_prospect_id_idx").on(table.prospectId),
  consentTypeIdx: index("idx_rgpd_consents_consent_type_idx").on(table.consentType),
}));

export type RgpdConsent = typeof rgpdConsents.$inferSelect;
export type InsertRgpdConsent = typeof rgpdConsents.$inferInsert;

// ============================================
// USER_2FA TABLE
// ============================================
export const user2FA = pgTable("user_2fa", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret"),
  isEnabled: boolean("is_enabled").default(false),
  backupCodes: json("backup_codes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: uniqueIndex("idx_user_2fa_user_id_idx").on(table.userId),
}));

export type User2FA = typeof user2FA.$inferSelect;
export type InsertUser2FA = typeof user2FA.$inferInsert;
