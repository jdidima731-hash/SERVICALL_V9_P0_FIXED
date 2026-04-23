import { pgTable, varchar, integer, timestamp, text, boolean, json, decimal, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { tenants, prospects, users } from "./schema";

// ============================================
// ENUMS MÉTIER (Normalisation des statuts)
// ============================================
export const orderStatusEnum = pgEnum("order_status", ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"]);
export const bookingStatusEnum = pgEnum("booking_status", ["confirmed", "checked_in", "checked_out", "cancelled", "no_show"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"]);
export const urgencyLevelEnum = pgEnum("urgency_level", ["low", "medium", "high", "critical"]);

// ============================================
// RESTAURANT: MENU ITEMS
// ============================================
export const menuItems = pgTable("menu_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }), // ex: "Pizza", "Pâtes", "Desserts"
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  available: boolean("available").default(true),
  allergens: json("allergens"), // Array of strings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  tenantIdIdx: index("idx_menu_items_tenant_id").on(table.tenantId),
  categoryIdx: index("idx_menu_items_category").on(table.category),
  availableIdx: index("idx_menu_items_available").on(table.available),
  tenantCategoryIdx: index("idx_menu_items_tenant_category").on(table.tenantId, table.category),
}));

// ============================================
// RESTAURANT: ORDERS (Industry-specific)
// ============================================
export const restaurantOrders = pgTable("restaurant_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  itemsJson: json("items_json").notNull(), // List of {menuItemId, quantity, price}
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  deliveryAddress: text("delivery_address"),
  status: orderStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_orders_tenant_id").on(table.tenantId),
  prospectIdIdx: index("idx_orders_prospect_id").on(table.prospectId),
  statusIdx: index("idx_orders_status").on(table.status),
  orderNumberIdx: uniqueIndex("idx_orders_number_unique").on(table.orderNumber),
  tenantCreatedIdx: index("idx_orders_tenant_created").on(table.tenantId, table.createdAt),
}));

// ============================================
// HOTEL: ROOMS
// ============================================
export const hotelRooms = pgTable("hotel_rooms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roomNumber: varchar("room_number", { length: 50 }).notNull(),
  roomType: varchar("room_type", { length: 100 }), // "Standard", "Suite", "Deluxe"
  pricePerNight: decimal("price_per_night", { precision: 10, scale: 2 }).notNull(),
  available: boolean("available").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_hotel_rooms_tenant_id").on(table.tenantId),
  roomNumberIdx: index("idx_hotel_rooms_number").on(table.roomNumber),
  availableIdx: index("idx_hotel_rooms_available").on(table.available),
  tenantRoomUniqueIdx: uniqueIndex("idx_hotel_rooms_tenant_number").on(table.tenantId, table.roomNumber),
}));

// ============================================
// HOTEL: BOOKINGS
// ============================================
export const bookings = pgTable("bookings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  roomId: integer("room_id").notNull().references(() => hotelRooms.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  status: bookingStatusEnum("status").default("confirmed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_bookings_tenant_id").on(table.tenantId),
  roomIdIdx: index("idx_bookings_room_id").on(table.roomId),
  prospectIdIdx: index("idx_bookings_prospect_id").on(table.prospectId),
  statusIdx: index("idx_bookings_status").on(table.status),
  checkInIdx: index("idx_bookings_check_in").on(table.checkIn),
  checkOutIdx: index("idx_bookings_check_out").on(table.checkOut),
}));

// ============================================
// MEDICAL: APPOINTMENTS
// ============================================
export const medicalAppointments = pgTable("medical_appointments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id").references(() => users.id, { onDelete: "set null" }),
  appointmentDate: timestamp("appointment_date").notNull(),
  symptoms: text("symptoms"),
  urgencyLevel: urgencyLevelEnum("urgency_level").default("low").notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_medical_app_tenant_id").on(table.tenantId),
  prospectIdIdx: index("idx_medical_app_prospect_id").on(table.prospectId),
  doctorIdIdx: index("idx_medical_app_doctor_id").on(table.doctorId),
  statusIdx: index("idx_medical_app_status").on(table.status),
  dateIdx: index("idx_medical_app_date").on(table.appointmentDate),
  urgencyIdx: index("idx_medical_app_urgency").on(table.urgencyLevel),
}));

// ============================================
// CUSTOMER EXTENDED DATA
// ============================================
export const customersExtended = pgTable("customers_extended", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prospectId: integer("prospect_id").notNull().unique().references(() => prospects.id, { onDelete: "cascade" }),
  preferences: json("preferences"), // ex: {"allergies": ["gluten"], "favorite_dishes": [...]}
  address: text("address"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  prospectIdIdx: uniqueIndex("idx_cust_ext_prospect_id_unique").on(table.prospectId),
}));

// ============================================
// REAL ESTATE: PROPERTIES
// ============================================
export const realEstateProperties = pgTable("real_estate_properties", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // "Achat", "Location"
  propertyType: varchar("property_type", { length: 50 }), // "Appartement", "Maison"
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  rooms: integer("rooms"),
  surface: decimal("surface", { precision: 10, scale: 2 }),
  available: boolean("available").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_re_prop_tenant_id").on(table.tenantId),
  typeIdx: index("idx_re_prop_type").on(table.type),
  locationIdx: index("idx_re_prop_location").on(table.location),
  priceIdx: index("idx_re_prop_price").on(table.price),
}));

// ============================================
// RECRUITMENT: JOB OFFERS
// ============================================
export const jobOffers = pgTable("job_offers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  department: varchar("department", { length: 100 }),
  location: varchar("location", { length: 255 }),
  salaryRange: varchar("salary_range", { length: 100 }),
  contractType: varchar("contract_type", { length: 50 }), // "CDI", "CDD", "Freelance"
  // Colonnes améliorées pour le module de recrutement IA
  requirementsId: integer("requirements_id"),
  skillsRequired: json("skills_required").$type<string[]>(),
  experienceYears: integer("experience_years").default(0),
  educationLevel: varchar("education_level", { length: 100 }),
  remoteWork: varchar("remote_work", { length: 50 }).default("onsite"), // "onsite", "remote", "hybrid"
  priority: varchar("priority", { length: 50 }).default("medium"), // "low", "medium", "high", "urgent"
  applicationDeadline: timestamp("application_deadline"),
  positionsCount: integer("positions_count").default(1),
  filledPositions: integer("filled_positions").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_jobs_tenant_id").on(table.tenantId),
  activeIdx: index("idx_jobs_active").on(table.isActive),
  priorityIdx: index("idx_jobs_priority").on(table.priority),
}));

// ============================================
// LEGAL: CASES
// ============================================
export const legalCases = pgTable("legal_cases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  caseType: varchar("case_type", { length: 100 }), // "Civil", "Pénal", "Travail"
  description: text("description"),
  status: varchar("status", { length: 50 }).default("open"),
  driveFolderUrl: text("drive_folder_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_legal_cases_tenant_id").on(table.tenantId),
  prospectIdIdx: index("idx_legal_cases_prospect_id").on(table.prospectId),
}));

// ============================================
// LOGISTICS: SHIPMENTS
// ============================================
export const shipments = pgTable("shipments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  trackingNumber: varchar("tracking_number", { length: 100 }).notNull().unique(),
  status: varchar("status", { length: 50 }).default("pending"), // "pending", "in_transit", "delivered", "failed"
  estimatedDelivery: timestamp("estimated_delivery"),
  actualDelivery: timestamp("actual_delivery"),
  shippingAddress: text("shipping_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_shipments_tenant_id").on(table.tenantId),
  trackingIdx: uniqueIndex("idx_shipments_tracking_unique").on(table.trackingNumber),
}));

// ============================================
// SERVICES: INTERVENTIONS (Plombier, Électricien...)
// ============================================
export const interventions = pgTable("interventions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 100 }).notNull(), // "Plomberie", "Électricité"
  description: text("description"),
  urgency: varchar("urgency", { length: 50 }).default("low"),
  scheduledAt: timestamp("scheduled_at"),
  status: varchar("status", { length: 50 }).default("scheduled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_interv_tenant_id").on(table.tenantId),
  statusIdx: index("idx_interv_status").on(table.status),
}));

// ============================================
// EDUCATION: ENROLLMENTS
// ============================================
export const enrollments = pgTable("enrollments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "cascade" }),
  courseName: varchar("course_name", { length: 255 }).notNull(),
  educationLevel: varchar("education_level", { length: 100 }),
  status: varchar("status", { length: 50 }).default("interested"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  tenantIdIdx: index("idx_enroll_tenant_id").on(table.tenantId),
  courseIdx: index("idx_enroll_course").on(table.courseName),
}));
