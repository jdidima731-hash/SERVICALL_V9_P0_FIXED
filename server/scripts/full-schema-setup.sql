-- FULL SCHEMA SETUP FOR SERVICALL CRM v2.0
-- This script ensures all tables, enums, and indexes are correctly created.

-- ENUMS
DO $$ BEGIN
    CREATE TYPE "role" AS ENUM ('admin', 'manager', 'agent', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "status" AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "call_type" AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "outcome" AS ENUM ('success', 'no_answer', 'voicemail', 'busy', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "trigger_type" AS ENUM ('manual', 'scheduled', 'event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "plan" AS ENUM ('free', 'starter', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "priority" AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "open_id" VARCHAR(255) NOT NULL UNIQUE,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "login_method" VARCHAR(50),
    "role" "role" DEFAULT 'user',
    "last_signed_in" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "email_idx" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "tenants" (
    "id" SERIAL PRIMARY KEY,
    "slug" VARCHAR(255) NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255),
    "logo" TEXT,
    "settings" JSON,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenant_users" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "role" TEXT DEFAULT 'agent',
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_user_unique" ON "tenant_users" ("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "prospects" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "email" TEXT,
    "phone" TEXT,
    "company" VARCHAR(255),
    "source" VARCHAR(100),
    "status" "status" DEFAULT 'new',
    "assigned_to" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
    "notes" TEXT,
    "metadata" JSON,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "prospects_tenant_id_idx" ON "prospects" ("tenant_id");
CREATE INDEX IF NOT EXISTS "prospects_status_idx" ON "prospects" ("status");
CREATE INDEX IF NOT EXISTS "prospects_assigned_to_idx" ON "prospects" ("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_prospects_lookup" ON "prospects" ("tenant_id", "phone");

CREATE TABLE IF NOT EXISTS "calls" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "prospect_id" INTEGER REFERENCES "prospects"("id") ON DELETE SET NULL,
    "agent_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
    "call_type" "call_type" DEFAULT 'outbound',
    "status" TEXT DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMP,
    "started_at" TIMESTAMP,
    "ended_at" TIMESTAMP,
    "duration" INTEGER,
    "outcome" "outcome",
    "notes" TEXT,
    "call_sid" VARCHAR(255) UNIQUE,
    "recording_url" TEXT,
    "metadata" JSON,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "workflows" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "trigger_type" "trigger_type" DEFAULT 'manual',
    "trigger_config" JSON,
    "actions" JSON NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE,
    "created_by" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenant_industry_config" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
    "industry_id" VARCHAR(255) NOT NULL,
    "enabled_capabilities" JSON,
    "enabled_workflows" JSON,
    "ai_system_prompt" TEXT,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "tenant_ai_keys" (
    "id" SERIAL PRIMARY KEY,
    "tenant_id" INTEGER NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'openai',
    "encrypted_key" TEXT NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE,
    "last_validated_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT NOW(),
    "updated_at" TIMESTAMP DEFAULT NOW()
);

-- INITIAL DATA
INSERT INTO "tenants" (id, slug, name, is_active) 
VALUES (1, 'default', 'Servicall Default', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "users" (id, open_id, name, email, role)
VALUES (1, 'admin-id', 'Admin', 'admin@test.com', 'admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "tenant_users" (tenant_id, user_id, role)
VALUES (1, 1, 'admin')
ON CONFLICT (tenant_id, user_id) DO NOTHING;
