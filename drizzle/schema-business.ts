/**
 * BUSINESS ENTITIES SCHEMA
 * Configuration métier multi-tenant générique
 */
import { pgTable, integer, varchar, text, decimal, json, boolean, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { tenants } from "./schema";

// ============================================
// ENUMS
// ============================================
export const businessTypeEnum = pgEnum("business_type", [
  "restaurant",
  "hotel",
  "real_estate",
  "clinic",
  "ecommerce",
  "artisan",
  "call_center",
  "generic"
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "product",      // Produit physique ou service
  "service",      // Service pur
  "property",     // Bien immobilier
  "room",         // Chambre d'hôtel
  "appointment",  // Créneau de rendez-vous
  "menu_item",    // Item de menu restaurant
  "other"         // Autre type
]);

// ============================================
// BUSINESS ENTITIES TABLE
// ============================================
export const businessEntities = pgTable("business_entities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  type: entityTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("20.00"),
  availabilityJson: json("availability_json"), // { days: [], hours: [], slots: [] }
  metadataJson: json("metadata_json"), // Données spécifiques métier
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("idx_business_entities_tenant_id").on(table.tenantId),
  typeIdx: index("idx_business_entities_type").on(table.type),
  isActiveIdx: index("idx_business_entities_is_active").on(table.isActive),
  tenantTypeIdx: index("idx_business_entities_tenant_type").on(table.tenantId, table.type),
  tenantActiveIdx: index("idx_business_entities_tenant_active").on(table.tenantId, table.isActive),
}));

export type BusinessEntity = typeof businessEntities.$inferSelect;
export type InsertBusinessEntity = typeof businessEntities.$inferInsert;

// ============================================
// POS ORDERS TABLE (Sync Tracking)
// ============================================
export const posOrders = pgTable("pos_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  crmOrderId: varchar("crm_order_id", { length: 255 }),
  posOrderId: varchar("pos_order_id", { length: 255 }),
  provider: varchar("provider", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
  syncLog: json("sync_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdIdx: index("idx_pos_orders_tenant_id").on(table.tenantId),
  crmIdIdx: index("idx_pos_orders_crm_id").on(table.crmOrderId),
  posIdIdx: index("idx_pos_orders_pos_id").on(table.posOrderId),
  tenantProviderIdx: index("idx_pos_orders_tenant_provider").on(table.tenantId, table.provider),
}));

export type PosOrder = typeof posOrders.$inferSelect;
export type InsertPosOrder = typeof posOrders.$inferInsert;
