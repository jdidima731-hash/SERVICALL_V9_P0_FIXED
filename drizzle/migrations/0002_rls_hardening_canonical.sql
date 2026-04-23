-- =====================================================================
-- 🚀 MIGRATION 0002 : RLS HARDENING CANONICAL (FAIL-CLOSED)
-- =====================================================================
-- Objectif : Imposer une isolation stricte inter-tenant sans aucun bypass.
-- =====================================================================

-- 1. Fonctions de validation strictes (Fail-Closed)
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
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
        
        -- Suppression des anciennes politiques
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON %I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON %I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON %I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON %I;', t, t);

        -- Création des nouvelles politiques strictes
        EXECUTE format('CREATE POLICY tenant_isolation_canonical ON %I 
                        AS RESTRICTIVE FOR ALL 
                        USING (tenant_id = app_require_tenant_id());', t);
    END LOOP;
END $$;

-- 3. Sécurisation spécifique de tenant_users (Bootstrap)
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_users_isolation ON tenant_users;

-- Un utilisateur ne peut voir que ses propres associations tenant
CREATE POLICY tenant_users_isolation ON tenant_users
AS RESTRICTIVE FOR SELECT
USING (user_id = app_require_user_id());

-- 4. Sécurisation spécifique de users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_isolation ON users;

-- Un utilisateur ne peut voir que lui-même
CREATE POLICY users_isolation ON users
AS RESTRICTIVE FOR SELECT
USING (id = app_require_user_id());

