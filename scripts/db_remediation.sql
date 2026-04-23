-- =============================================================================
-- SERVICALL — SCRIPT DE REMISE EN COHÉRENCE DB
-- =============================================================================
-- Ce script est IDEMPOTENT (100% IF NOT EXISTS / DO NOTHING).
-- Il ne touche PAS aux tables existantes ni aux données.
-- Il crée uniquement ce qui manque et initialise le journal Drizzle.
--
-- ORDRE D'EXÉCUTION :
--   psql $DATABASE_URL -f scripts/db_remediation.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 — ENUMs manquants (idempotents)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('owner', 'superadmin', 'admin', 'manager', 'agent', 'agentIA', 'user');
EXCEPTION WHEN duplicate_object THEN
  -- Ajouter les valeurs manquantes si l'enum existe déjà en version ancienne
  BEGIN ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'owner'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'superadmin'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'agentIA'; EXCEPTION WHEN others THEN NULL; END;
END $$;

DO $$ BEGIN
  CREATE TYPE "social_platform" AS ENUM ('facebook', 'instagram', 'linkedin', 'twitter', 'tiktok');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "post_status" AS ENUM ('draft', 'scheduled', 'published', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "post_type" AS ENUM ('promotion', 'educational', 'testimonial', 'news', 'event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Table __drizzle_migrations (journal Drizzle)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  "id"         SERIAL PRIMARY KEY,
  "hash"       TEXT NOT NULL,
  "created_at" BIGINT
);

-- Marquer toutes les migrations comme déjà appliquées (DB construite hors Drizzle)
-- Drizzle ne les rejouera pas si elles sont dans ce journal.
INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES
  ('0000_freezing_quicksilver',         1771168409018),
  ('0001_add_business_configuration',   1771254000000),
  ('0002_add_pos_config_and_vat',        1771255200000),
  ('0003_add_recruitment_module',        1771263360000),
  ('0004_fix_simulated_calls',           1771300000000),
  ('0005_add_recruitment_enhancements',  1771350000000),
  ('0006_lead_extractions',              1771400000000),
  ('0007_rename_public_api_keys',        1771410000000),
  ('0008_byok_workflows_table',          1771420000000)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Tables CRITIQUES manquantes (auth, workflows, core)
-- ─────────────────────────────────────────────────────────────────────────────

-- tenant_users — CRITIQUE (login impossible sans elle)
CREATE TABLE IF NOT EXISTS "tenant_users" (
  "id"         INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"  INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"       TEXT DEFAULT 'agent',
  "is_active"  BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now(),
  "updated_at" TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_user_unique"
  ON "tenant_users"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "tenant_users_user_id_idx"
  ON "tenant_users"("user_id");
CREATE INDEX IF NOT EXISTS "tenant_users_tenant_id_idx"
  ON "tenant_users"("tenant_id");

-- revoked_tokens — CRITIQUE (logout JWT)
CREATE TABLE IF NOT EXISTS "revoked_tokens" (
  "jti"        VARCHAR(255) PRIMARY KEY,
  "exp"        TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT now()
);

-- workflows — CRITIQUE (router workflows, jobs FK)
CREATE TABLE IF NOT EXISTS "workflows" (
  "id"             INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"      INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"           VARCHAR(255) NOT NULL,
  "description"    TEXT,
  "trigger_type"   VARCHAR(50) DEFAULT 'manual',
  "trigger_config" JSON,
  "actions"        JSON NOT NULL DEFAULT '[]',
  "is_active"      BOOLEAN DEFAULT true,
  "created_by"     INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"     TIMESTAMP DEFAULT now(),
  "updated_at"     TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "workflows_tenant_id_idx"
  ON "workflows"("tenant_id");
CREATE INDEX IF NOT EXISTS "workflows_is_active_idx"
  ON "workflows"("is_active");
CREATE INDEX IF NOT EXISTS "workflows_tenant_created_idx"
  ON "workflows"("tenant_id", "created_at" DESC NULLS LAST);

-- workflow_executions
CREATE TABLE IF NOT EXISTS "workflow_executions" (
  "id"           INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "workflow_id"  INTEGER NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "tenant_id"    INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "status"       VARCHAR(50) NOT NULL DEFAULT 'pending',
  "trigger"      VARCHAR(100) NOT NULL,
  "input"        JSON,
  "output"       JSON,
  "error"        TEXT,
  "started_at"   TIMESTAMP DEFAULT now(),
  "completed_at" TIMESTAMP,
  "created_at"   TIMESTAMP DEFAULT now(),
  "updated_at"   TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "workflow_executions_workflow_id_idx"
  ON "workflow_executions"("workflow_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_tenant_id_idx"
  ON "workflow_executions"("tenant_id");
CREATE INDEX IF NOT EXISTS "workflow_executions_status_idx"
  ON "workflow_executions"("status");

-- workflow_dead_letters
CREATE TABLE IF NOT EXISTS "workflow_dead_letters" (
  "id"          INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"   INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "workflow_id" INTEGER,
  "job_id"      VARCHAR(255) NOT NULL,
  "queue_name"  VARCHAR(100) NOT NULL,
  "payload"     JSON NOT NULL,
  "error"       TEXT,
  "stack"       TEXT,
  "attempts"    INTEGER DEFAULT 0,
  "status"      VARCHAR(50) DEFAULT 'failed',
  "resolved_at" TIMESTAMP,
  "created_at"  TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_workflow_dead_letters_tenant_id_idx"
  ON "workflow_dead_letters"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_dead_letters_job_id_idx"
  ON "workflow_dead_letters"("job_id");

-- workflow_templates
CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id"           INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "industry_id"  VARCHAR(255) NOT NULL,
  "template_id"  VARCHAR(255) NOT NULL,
  "name"         VARCHAR(255) NOT NULL,
  "description"  TEXT,
  "trigger_type" VARCHAR(50),
  "steps"        JSON NOT NULL,
  "is_active"    BOOLEAN DEFAULT true,
  "created_at"   TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "unique_template_idx"
  ON "workflow_templates"("industry_id", "template_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_templates_industry_id_idx"
  ON "workflow_templates"("industry_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — BYOK / API Keys
-- ─────────────────────────────────────────────────────────────────────────────

-- api_keys (BYOK — clés chiffrées par provider)
-- Note: Manus a ajouté tenant_id à une ancienne table api_keys — cette version
-- est la définition Drizzle correcte avec encrypted_key (≠ key plaintext).
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"            INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"     INTEGER NOT NULL,
  "provider"      VARCHAR(100) NOT NULL,
  "encrypted_key" TEXT NOT NULL,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at"    TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_tenant_provider_idx"
  ON "api_keys"("tenant_id", "provider");
CREATE INDEX IF NOT EXISTS "api_keys_tenant_id_idx"
  ON "api_keys"("tenant_id");

-- byok_audit_logs
CREATE TABLE IF NOT EXISTS "byok_audit_logs" (
  "id"         INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"  INTEGER NOT NULL,
  "action"     VARCHAR(50) NOT NULL,
  "provider"   VARCHAR(100) NOT NULL,
  "status"     VARCHAR(20) NOT NULL,
  "message"    TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "byok_audit_logs_tenant_id_idx"
  ON "byok_audit_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "byok_audit_logs_created_at_idx"
  ON "byok_audit_logs"("created_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 — Configuration tenant
-- ─────────────────────────────────────────────────────────────────────────────

-- tenant_settings
CREATE TABLE IF NOT EXISTS "tenant_settings" (
  "id"                    INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"             INTEGER NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ai_automation_rate"    INTEGER DEFAULT 80,
  "escalation_threshold"  INTEGER DEFAULT 50,
  "agent_switch_settings" JSON DEFAULT '{}',
  "updated_at"            TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_settings_tenant_id_unique"
  ON "tenant_settings"("tenant_id");

-- tenant_ai_keys
CREATE TABLE IF NOT EXISTS "tenant_ai_keys" (
  "id"                INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"         INTEGER NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider"          VARCHAR(50) NOT NULL DEFAULT 'openai',
  "encrypted_key"     TEXT NOT NULL,
  "key_hash"          VARCHAR(255) NOT NULL,
  "is_active"         BOOLEAN DEFAULT true,
  "last_validated_at" TIMESTAMP,
  "created_at"        TIMESTAMP DEFAULT now(),
  "updated_at"        TIMESTAMP DEFAULT now(),
  CONSTRAINT "tenant_ai_keys_tenant_id_unique" UNIQUE("tenant_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_ai_keys_tenant_id_unique"
  ON "tenant_ai_keys"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_ai_keys_provider_idx"
  ON "tenant_ai_keys"("provider");

-- tenant_industry_config
CREATE TABLE IF NOT EXISTS "tenant_industry_config" (
  "id"                   INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"            INTEGER NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "industry_id"          VARCHAR(255) NOT NULL,
  "enabled_capabilities" JSON,
  "enabled_workflows"    JSON,
  "ai_system_prompt"     TEXT,
  "created_at"           TIMESTAMP DEFAULT now(),
  "updated_at"           TIMESTAMP DEFAULT now(),
  CONSTRAINT "tenant_industry_config_tenant_id_unique" UNIQUE("tenant_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_tenant_industry_config_tenant_id_unique"
  ON "tenant_industry_config"("tenant_id");

-- usage_metrics
CREATE TABLE IF NOT EXISTS "usage_metrics" (
  "id"          INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"   INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "metric_type" VARCHAR(100) NOT NULL,
  "value"       INTEGER DEFAULT 0,
  "period"      VARCHAR(50),
  "recorded_at" TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_usage_metrics_tenant_id_idx"
  ON "usage_metrics"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_usage_metrics_metric_type_idx"
  ON "usage_metrics"("metric_type");

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 — AI tables
-- ─────────────────────────────────────────────────────────────────────────────

-- ai_roles
CREATE TABLE IF NOT EXISTS "ai_roles" (
  "id"          INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"   INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"        VARCHAR(255) NOT NULL,
  "description" TEXT,
  "prompt"      TEXT NOT NULL,
  "model"       VARCHAR(100) DEFAULT 'gpt-4',
  "temperature" DECIMAL(3, 2) DEFAULT 0.7,
  "is_active"   BOOLEAN DEFAULT true,
  "metadata"    JSON DEFAULT '{}',
  "created_at"  TIMESTAMP DEFAULT now(),
  "updated_at"  TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_ai_roles_tenant_id_idx"
  ON "ai_roles"("tenant_id");

-- ai_memories
CREATE TABLE IF NOT EXISTS "ai_memories" (
  "id"                  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"           INTEGER NOT NULL,
  "contact_identifier"  TEXT NOT NULL,
  "contact_name"        TEXT,
  "channel"             VARCHAR(20) NOT NULL DEFAULT 'call',
  "summary"             TEXT NOT NULL,
  "key_facts"           JSON DEFAULT '{}',
  "interaction_date"    TIMESTAMP NOT NULL DEFAULT now(),
  "created_at"          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_ai_memories_lookup"
  ON "ai_memories"("tenant_id", "contact_identifier", "interaction_date");

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 — CRM / Social / Deals
-- ─────────────────────────────────────────────────────────────────────────────

-- deals
CREATE TABLE IF NOT EXISTS "deals" (
  "id"                  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"           INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "prospect_id"         INTEGER REFERENCES "prospects"("id") ON DELETE SET NULL,
  "assigned_to"         INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "title"               VARCHAR(255) NOT NULL,
  "description"         TEXT,
  "value"               DECIMAL(12, 2),
  "currency"            VARCHAR(3) DEFAULT 'EUR',
  "status"              VARCHAR(50) DEFAULT 'open',
  "probability"         INTEGER DEFAULT 0,
  "expected_close_date" TIMESTAMP,
  "metadata"            JSON,
  "created_at"          TIMESTAMP DEFAULT now(),
  "updated_at"          TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_deals_tenant_id_idx"
  ON "deals"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_deals_prospect_id_idx"
  ON "deals"("prospect_id");
CREATE INDEX IF NOT EXISTS "idx_deals_assigned_to_idx"
  ON "deals"("assigned_to");
CREATE INDEX IF NOT EXISTS "idx_deals_status_idx"
  ON "deals"("status");

-- scheduled_callbacks
CREATE TABLE IF NOT EXISTS "scheduled_callbacks" (
  "id"             INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"      INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "prospect_phone" VARCHAR(50) NOT NULL,
  "prospect_name"  VARCHAR(255),
  "prospect_id"    INTEGER,
  "call_sid"       VARCHAR(255),
  "call_id"        INTEGER,
  "trigger_reason" VARCHAR(50) NOT NULL,
  "scheduled_at"   TIMESTAMP NOT NULL,
  "notify_mode"    VARCHAR(20) NOT NULL DEFAULT 'crm',
  "status"         VARCHAR(20) NOT NULL DEFAULT 'pending',
  "created_at"     TIMESTAMP DEFAULT now(),
  "updated_at"     TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_scheduled_callbacks_tenant_id_idx"
  ON "scheduled_callbacks"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_callbacks_scheduled_at_idx"
  ON "scheduled_callbacks"("scheduled_at");

-- social_accounts
CREATE TABLE IF NOT EXISTS "social_accounts" (
  "id"                  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"           INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "platform"            "social_platform" NOT NULL,
  "platform_account_id" VARCHAR(255) NOT NULL,
  "account_name"        VARCHAR(255),
  "access_token"        TEXT,
  "refresh_token"       TEXT,
  "token_expires_at"    TIMESTAMP,
  "is_active"           BOOLEAN DEFAULT true,
  "metadata"            JSON,
  "created_at"          TIMESTAMP DEFAULT now(),
  "updated_at"          TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_social_accounts_tenant_platform"
  ON "social_accounts"("tenant_id", "platform");
CREATE INDEX IF NOT EXISTS "idx_social_accounts_tenant_id"
  ON "social_accounts"("tenant_id");

-- social_posts
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id"                 INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"          INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id"            INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "platform"           "social_platform" NOT NULL,
  "status"             "post_status" DEFAULT 'draft',
  "type"               "post_type" DEFAULT 'news',
  "content"            TEXT NOT NULL,
  "original_prompt"    TEXT,
  "image_url"          TEXT,
  "media_metadata"     JSON,
  "hashtags"           JSON,
  "scheduled_at"       TIMESTAMP,
  "published_at"       TIMESTAMP,
  "platform_post_id"   VARCHAR(255),
  "platform_url"       TEXT,
  "error"              TEXT,
  "likes_count"        INTEGER DEFAULT 0,
  "comments_count"     INTEGER DEFAULT 0,
  "shares_count"       INTEGER DEFAULT 0,
  "reach_count"        INTEGER DEFAULT 0,
  "metadata"           JSON,
  "created_at"         TIMESTAMP DEFAULT now(),
  "updated_at"         TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_social_posts_tenant_id"
  ON "social_posts"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_social_posts_status"
  ON "social_posts"("status");
CREATE INDEX IF NOT EXISTS "idx_social_posts_scheduled_at"
  ON "social_posts"("scheduled_at");
CREATE INDEX IF NOT EXISTS "idx_social_posts_tenant_status"
  ON "social_posts"("tenant_id", "status");

-- social_comments
CREATE TABLE IF NOT EXISTS "social_comments" (
  "id"                  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id"           INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "post_id"             INTEGER NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "platform_comment_id" VARCHAR(255) NOT NULL,
  "author_name"         VARCHAR(255),
  "author_id"           VARCHAR(255),
  "content"             TEXT NOT NULL,
  "sentiment"           VARCHAR(20),
  "intent_detected"     VARCHAR(50),
  "is_replied"          BOOLEAN DEFAULT false,
  "reply_content"       TEXT,
  "replied_at"          TIMESTAMP,
  "created_at"          TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_social_comments_post_id"
  ON "social_comments"("post_id");
CREATE INDEX IF NOT EXISTS "idx_social_comments_tenant_id"
  ON "social_comments"("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_social_comments_platform_id"
  ON "social_comments"("platform_comment_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 7 — Colonnes manquantes sur tables existantes
-- ─────────────────────────────────────────────────────────────────────────────

-- tenants: colonnes ajoutées par migrations 0001/0002 potentiellement absentes
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "business_type"   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "ai_custom_script" TEXT,
  ADD COLUMN IF NOT EXISTS "pos_provider"    VARCHAR(50) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "pos_config"      JSONB,
  ADD COLUMN IF NOT EXISTS "pos_sync_enabled" BOOLEAN DEFAULT false;

-- users: colonnes extended
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_active"                 BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "assigned_agent_type"       VARCHAR(10) DEFAULT 'AI',
  ADD COLUMN IF NOT EXISTS "callback_phone"            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "callback_notify_mode"      VARCHAR(20) DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS "is_available_for_transfer" BOOLEAN DEFAULT true;

-- stripe_events: colonnes Drizzle vs schema_final_prod
ALTER TABLE "stripe_events"
  ADD COLUMN IF NOT EXISTS "event_id"   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "processed"  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT now();

-- appointments: colonne start_time (Drizzle schema utilise start_time, pas scheduled_at)
ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "start_time"  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "end_time"    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "user_id"     INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMP DEFAULT now();

-- calls: colonnes manquantes
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "quality_score" NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS "user_id"       INTEGER REFERENCES "users"("id") ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 8 — Vérification finale
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  missing_count INTEGER := 0;
  tbl TEXT;
  critical_tables TEXT[] := ARRAY[
    'tenant_users', 'revoked_tokens', 'workflows', 'workflow_executions',
    'api_keys', 'deals', 'social_posts', 'social_accounts',
    'ai_roles', 'ai_memories', 'tenant_settings', 'tenant_ai_keys',
    '__drizzle_migrations'
  ];
BEGIN
  FOREACH tbl IN ARRAY critical_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE WARNING '❌ Table encore manquante : %', tbl;
      missing_count := missing_count + 1;
    END IF;
  END LOOP;

  IF missing_count = 0 THEN
    RAISE NOTICE '✅ Toutes les tables critiques sont présentes.';
  ELSE
    RAISE NOTICE '⚠️  % table(s) encore manquante(s) — voir warnings ci-dessus.', missing_count;
  END IF;
END $$;
