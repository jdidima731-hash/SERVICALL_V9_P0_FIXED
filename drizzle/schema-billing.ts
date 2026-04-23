/**
 * SCHEMA — Domaine Facturation (Billing)
 * Tables : orders, orderItems, customerInvoices
 */
import { pgTable, varchar, integer, timestamp, text, boolean, json, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants, prospects } from "./schema";

// ============================================
// ORDERS TABLE
// ============================================
export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  orderNumber: varchar("order_number", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("unpaid"),
  shippingAddress: json("shipping_address"),
  billingAddress: json("billing_address"),
  notes: text("notes"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_orders_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_orders_prospect_id_idx").on(table.prospectId),
  statusIdx: index("idx_orders_status_idx").on(table.status),
  orderNumberIdx: uniqueIndex("idx_orders_order_number_idx_unique").on(table.orderNumber),
}));

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================
// ORDER_ITEMS TABLE
// ============================================
export const orderItems = pgTable("order_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  metadata: json("metadata"),
}, (table) => ({
  orderIdIdx: index("idx_order_items_order_id_idx").on(table.orderId),
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================
// CUSTOMER_INVOICES TABLE
// ============================================
export const customerInvoices = pgTable("customer_invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  callId: integer("call_id"),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("EUR"),
  description: text("description"),
  template: varchar("template", { length: 100 }).default("default"),
  status: varchar("status", { length: 50 }).default("pending"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  secureToken: text("secure_token"),
  secureLink: text("secure_link"),
  linkExpiresAt: timestamp("link_expires_at"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("unpaid"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  acceptedBy: varchar("accepted_by", { length: 255 }),
  acceptedIP: varchar("accepted_ip", { length: 45 }),
  signatureData: text("signature_data"),
}, (table) => ({
  tenantIdIdx: index("idx_customer_invoices_tenant_id_idx").on(table.tenantId),
  prospectIdIdx: index("idx_customer_invoices_prospect_id_idx").on(table.prospectId),
  invoiceNumberIdx: uniqueIndex("idx_customer_invoices_invoice_number_unique").on(table.invoiceNumber),
  statusIdx: index("idx_customer_invoices_status_idx").on(table.status),
}));

export type CustomerInvoice = typeof customerInvoices.$inferSelect;
export type InsertCustomerInvoice = typeof customerInvoices.$inferInsert;

// ============================================
// RELATIONS
// ============================================
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  prospect: one(prospects, {
    fields: [orders.prospectId],
    references: [prospects.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

// ============================================
// STRIPE_EVENTS TABLE (Webhook Events)
// ============================================
export const stripeEvents = pgTable("stripe_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull().unique(),
  type: varchar("type", { length: 255 }).notNull(),
  payload: json("payload").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  error: text("error"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  stripeEventIdIdx: uniqueIndex("idx_stripe_events_stripe_event_id_unique").on(table.stripeEventId),
  statusIdx: index("idx_stripe_events_status_idx").on(table.status),
}));

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type InsertStripeEvent = typeof stripeEvents.$inferInsert;
