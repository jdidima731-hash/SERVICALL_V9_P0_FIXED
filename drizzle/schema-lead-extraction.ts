/**
 * SCHEMA — Lead Extraction
 * Table lead_extractions : historique des recherches de leads par fournisseur
 * (OpenStreetMap, Google Maps, Pages Jaunes)
 */

import { pgTable, integer, varchar, text, timestamp, json, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./schema";

// ============================================
// LEAD_EXTRACTIONS TABLE
// ============================================
export const leadExtractions = pgTable(
  "lead_extractions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    query: varchar("query", { length: 255 }).notNull(),
    location: varchar("location", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(), // 'osm' | 'google' | 'pagesjaunes'
    radius: integer("radius").default(5000),
    resultsCount: integer("results_count").default(0),
    importedCount: integer("imported_count").default(0),
    status: varchar("status", { length: 20 }).notNull().default("done"), // 'pending' | 'done' | 'error'
    errorMessage: text("error_message"),
    resultsSnapshot: json("results_snapshot"), // snapshot des résultats bruts (pour ré-import)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("lead_extractions_tenant_id_idx").on(table.tenantId),
    createdAtIdx: index("lead_extractions_created_at_idx").on(table.createdAt),
    providerIdx: index("lead_extractions_provider_idx").on(table.provider),
  })
);

export type LeadExtraction = typeof leadExtractions.$inferSelect;
export type InsertLeadExtraction = typeof leadExtractions.$inferInsert;

// ── Relations ─────────────────────────────────────────────────────────────
export const leadExtractionsRelations = relations(leadExtractions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadExtractions.tenantId],
    references: [tenants.id],
  }),
}));
