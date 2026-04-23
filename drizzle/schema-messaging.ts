/**
 * SCHEMA — Domaine Messagerie
 * Tables : messageTemplates
 */
import { pgTable, varchar, integer, timestamp, text, index } from "drizzle-orm/pg-core";
import { tenants } from "./schema";

// ============================================
// MESSAGE_TEMPLATES TABLE
// ============================================
export const messageTemplates = pgTable("message_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'sms', 'whatsapp', 'email'
  subject: varchar("subject", { length: 255 }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_message_templates_tenant_id_idx").on(table.tenantId),
}));

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;
