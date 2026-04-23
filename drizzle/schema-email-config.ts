/**
 * EMAIL CONFIGURATION SCHEMA
 * Permet aux utilisateurs de configurer leurs propres serveurs email
 * Supporte : Resend, SMTP, SendGrid, Mailgun
 */

import { pgTable, integer, varchar, json, timestamp, text, boolean, index } from "drizzle-orm/pg-core";
import { tenants } from "./schema";

export const emailConfigurations = pgTable("email_configurations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Relation au tenant
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  
  // Type de provider
  provider: varchar("provider", { length: 50 }).notNull(), // 'resend', 'smtp', 'sendgrid', 'mailgun'
  
  // Nom de la configuration (ex: "Production", "Test")
  name: varchar("name", { length: 255 }).notNull(),
  
  // Email d'envoi par défaut
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  
  // Credentials chiffrés (stockés chiffrés en base)
  encryptedCredentials: text("encrypted_credentials").notNull(),
  
  // Configuration spécifique au provider (non-sensible)
  config: json("config"), // ex: { replyTo: "support@example.com", tags: ["transactional"] }
  
  // Statut de la configuration
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  
  // Dernière vérification de connexion
  lastTestedAt: timestamp("last_tested_at"),
  lastTestStatus: varchar("last_test_status", { length: 50 }), // 'success', 'failed'
  lastTestError: text("last_test_error"),
  
  // Statistiques d'utilisation
  emailsSentCount: integer("emails_sent_count").default(0),
  emailsFailedCount: integer("emails_failed_count").default(0),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by"),
  updatedBy: integer("updated_by"),
}, (table) => ({
  tenantIdIdx: index("email_config_tenant_id_idx").on(table.tenantId),
  providerIdx: index("email_config_provider_idx").on(table.provider),
  isActiveIdx: index("email_config_is_active_idx").on(table.isActive),
  isDefaultIdx: index("email_config_is_default_idx").on(table.isDefault),
}));

export type EmailConfiguration = typeof emailConfigurations.$inferSelect;
export type InsertEmailConfiguration = typeof emailConfigurations.$inferInsert;

/**
 * Types pour les credentials de chaque provider
 */
export interface ResendCredentials {
  apiKey: string;
}

export interface SMTPCredentials {
  host: string;
  port: number;
  secure: boolean; // TLS
  username: string;
  password: string;
}

export interface SendGridCredentials {
  apiKey: string;
}

export interface MailgunCredentials {
  apiKey: string;
  domain: string;
  region?: 'us' | 'eu'; // Mailgun US or EU
}

export type EmailCredentials = ResendCredentials | SMTPCredentials | SendGridCredentials | MailgunCredentials;

/**
 * Logs d'envoi d'emails pour audit
 */
export const emailLogs = pgTable("email_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Relation
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  configurationId: integer("configuration_id").notNull().references(() => emailConfigurations.id, { onDelete: "set null" }),
  
  // Détails du mail
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  
  // Statut
  status: varchar("status", { length: 50 }).notNull(), // 'sent', 'failed', 'bounced'
  error: text("error"),
  
  // Métadonnées du provider
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  providerResponse: json("provider_response"),
  
  // Workflow context
  workflowId: integer("workflow_id"),
  workflowExecutionId: integer("workflow_execution_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("email_logs_tenant_id_idx").on(table.tenantId),
  configurationIdIdx: index("email_logs_configuration_id_idx").on(table.configurationId),
  statusIdx: index("email_logs_status_idx").on(table.status),
  createdAtIdx: index("email_logs_created_at_idx").on(table.createdAt),
  toEmailIdx: index("email_logs_to_email_idx").on(table.toEmail),
}));

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;
