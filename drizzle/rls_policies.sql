-- =====================================================================
-- 🚀 RLS POLICIES — SERVICALL V8 — ENTERPRISE HARDENING (FAIL-CLOSED)
-- =====================================================================
-- Objectif : Imposer une isolation stricte inter-tenant sans aucun bypass.
-- Ce script unifie les fonctions de validation et les politiques de sécurité.
-- =====================================================================

-- 1. Fonctions de validation strictes (Fail-Closed)
-- Ces fonctions lèvent une exception si les variables de session sont absentes.
CREATE OR REPLACE FUNCTION app_require_tenant_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_tenant_id text;
BEGIN
    v_tenant_id := current_setting('app.tenant_id', true);
    IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
        RAISE EXCEPTION 'RLS_ERROR: app.tenant_id is missing or empty. Access denied.';
    END IF;
    RETURN v_tenant_id::integer;
END;
$$;

CREATE OR REPLACE FUNCTION app_require_user_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_user_id text;
BEGIN
    v_user_id := current_setting('app.user_id', true);
    IF v_user_id IS NULL OR v_user_id = '' THEN
        RAISE EXCEPTION 'RLS_ERROR: app.user_id is missing or empty. Access denied.';
    END IF;
    RETURN v_user_id::integer;
END;
$$;

-- 2. Activation de RLS sur toutes les tables multi-tenant
-- Ce bloc itère sur toutes les tables possédant une colonne 'tenant_id'
-- et applique une politique restrictive basée sur app_require_tenant_id().
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'tenant_id' 
          AND table_schema = 'public'
          AND table_name NOT IN ('tenants', 'users', 'tenant_users')
    LOOP
        -- Activer RLS et forcer son application même pour le propriétaire de la table
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
        
        -- Nettoyage des anciennes politiques pour éviter les conflits
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_canonical ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS prospect_tenant_isolation ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS call_tenant_isolation ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS workflow_tenant_isolation ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS workflow_execution_tenant_isolation ON %I;', t);
        
        -- Création de la politique canonique V8
        EXECUTE format('CREATE POLICY tenant_isolation_v8 ON %I 
                        AS RESTRICTIVE FOR ALL 
                        USING (tenant_id = app_require_tenant_id());', t);
        
        RAISE NOTICE 'RLS Hardening applied to table: %', t;
    END LOOP;
END $$;

-- 3. Sécurisation spécifique de tenant_users (Bootstrap)
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users_isolation ON tenant_users;

-- Un utilisateur ne peut voir que ses propres associations tenant (Fail-Closed)
CREATE POLICY tenant_users_isolation_v8 ON tenant_users
AS RESTRICTIVE FOR SELECT
USING (user_id = app_require_user_id());

-- 4. Sécurisation spécifique de users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_isolation ON users;

-- Un utilisateur ne peut voir que son propre profil (Fail-Closed)
CREATE POLICY users_isolation_v8 ON users
AS RESTRICTIVE FOR SELECT
USING (id = app_require_user_id());

-- 5. Sécurisation de la table tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;

-- Un utilisateur ne peut voir que les tenants auxquels il est lié
CREATE POLICY tenants_isolation_v8 ON tenants
AS RESTRICTIVE FOR SELECT
USING (
    id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE user_id = app_require_user_id()
    )
);
