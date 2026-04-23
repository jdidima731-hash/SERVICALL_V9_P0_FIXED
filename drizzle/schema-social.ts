import { pgTable, integer, varchar, text, timestamp, json, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants, users } from "./schema";
import { pgEnum } from "drizzle-orm/pg-core";

// ============================================
// ENUMS pour le module Social Media
// ============================================
export const socialPlatformEnum = pgEnum("social_platform", ["facebook", "instagram", "linkedin", "twitter", "tiktok"]);
export const postStatusEnum = pgEnum("post_status", ["draft", "scheduled", "published", "failed"]);
export const postTypeEnum = pgEnum("post_type", ["promotion", "educational", "testimonial", "news", "event"]);

// ============================================
// TABLE: social_accounts
// Comptes réseaux sociaux connectés par tenant
// ============================================
export const socialAccounts = pgTable("social_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  platform: socialPlatformEnum("platform").notNull(),
  platformAccountId: varchar("platform_account_id", { length: 255 }).notNull(),
  accountName: varchar("account_name", { length: 255 }),
  accessToken: text("access_token"), // Encrypted in real app
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").default(true),  tiktokVideoIdea: text("tiktok_video_idea"),

  metadata: json("metadata"), // ex: profile picture, follower count
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantPlatformIdx: uniqueIndex("idx_social_accounts_tenant_platform").on(table.tenantId, table.platform),
  tenantIdIdx: index("idx_social_accounts_tenant_id").on(table.tenantId),
}));

// ============================================
// TABLE: social_posts
// Posts planifiés ou publiés
// ============================================
export const socialPosts = pgTable("social_posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  
  platform: socialPlatformEnum("platform").notNull(),
  status: postStatusEnum("status").default("draft"),
  type: postTypeEnum("type").default("news"),
  
  content: text("content").notNull(), // Le texte du post (avec placeholders résolus)
  originalPrompt: text("original_prompt"), // Le prompt initial si généré par IA
  
  imageUrl: text("image_url"),
  mediaMetadata: json("media_metadata"), // { alt: "...", width: 1024, height: 1024 }
  
  hashtags: json("hashtags").$type<string[]>(),
  
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  
  platformPostId: varchar("platform_post_id", { length: 255 }), // ID sur le réseau social
  platformUrl: text("platform_url"),
  
  error: text("error"),
  
  // Analytics (Snapshot)
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  sharesCount: integer("shares_count").default(0),
  reachCount: integer("reach_count").default(0),
  
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("idx_social_posts_tenant_id").on(table.tenantId),
  statusIdx: index("idx_social_posts_status").on(table.status),
  scheduledAtIdx: index("idx_social_posts_scheduled_at").on(table.scheduledAt),
  tenantStatusIdx: index("idx_social_posts_tenant_status").on(table.tenantId, table.status),
}));

// ============================================
// TABLE: social_comments
// Commentaires détectés pour engagement automatique
// ============================================
export const socialComments = pgTable("social_comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  postId: integer("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  
  platformCommentId: varchar("platform_comment_id", { length: 255 }).notNull(),
  authorName: varchar("author_name", { length: 255 }),
  authorId: varchar("author_id", { length: 255 }),
  content: text("content").notNull(),
  
  sentiment: varchar("sentiment", { length: 20 }), // positive, neutral, negative
  intentDetected: varchar("intent_detected", { length: 50 }), // purchase, question, complaint
  
  isReplied: boolean("is_replied").default(false),
  replyContent: text("reply_content"),
  repliedAt: timestamp("replied_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  postIdIdx: index("idx_social_comments_post_id").on(table.postId),
  tenantIdIdx: index("idx_social_comments_tenant_id").on(table.tenantId),
  platformCommentIdx: uniqueIndex("idx_social_comments_platform_id").on(table.platformCommentId),
}));
