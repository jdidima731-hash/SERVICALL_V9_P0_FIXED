import { pgTable, integer, varchar, text, timestamp, json, decimal, index } from "drizzle-orm/pg-core";
import { tenants, prospects, users } from "./schema";

// ============================================
// DEALS TABLE
// ============================================
export const deals = pgTable("deals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  value: decimal("value", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  status: varchar("status", { length: 50 }).default("open"), // 'open', 'won', 'lost', 'closed'
  probability: integer("probability").default(0), // 0-100
  expectedCloseDate: timestamp("expected_close_date"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_deals_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_deals_prospect_id_idx").on(table.prospectId),
  assignedToIdx: index("idx_deals_assigned_to_idx").on(table.assignedTo),
  statusIdx: index("idx_deals_status_idx").on(table.status),
}));

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;
