-- ============================================================================
-- Migration: Add tenant switching support (many-to-many user-tenant relationship)
-- Description: Enable users to belong to multiple tenants and switch between them
-- Date: 2025-11-12
-- Author: Claude Code
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE USER_TENANTS JUNCTION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'hr_manager', -- Per-tenant role (can differ from user.role)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate user-tenant assignments
  CONSTRAINT unique_user_tenant UNIQUE(user_id, tenant_id)
);

-- Add indexes for query performance
CREATE INDEX idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX idx_user_tenants_user_tenant ON user_tenants(user_id, tenant_id);

COMMENT ON TABLE user_tenants IS 'Junction table for many-to-many relationship between users and tenants';
COMMENT ON COLUMN user_tenants.role IS 'Per-tenant role override (user can be admin in one tenant, hr_manager in another)';

-- ============================================================================
-- 2. ADD ACTIVE_TENANT_ID TO USERS TABLE
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_tenant_id UUID REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_users_active_tenant_id ON users(active_tenant_id);

COMMENT ON COLUMN users.active_tenant_id IS 'Currently selected tenant for this user session (must be in user_tenants)';

-- ============================================================================
-- 3. MIGRATE EXISTING USERS TO USER_TENANTS
-- ============================================================================

-- Copy all existing user-tenant assignments to the junction table
INSERT INTO user_tenants (user_id, tenant_id, role)
SELECT id, tenant_id, role
FROM users
WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Make tenant_id nullable (for backward compatibility during transition)
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

COMMENT ON COLUMN users.tenant_id IS 'DEPRECATED: Use active_tenant_id instead. Kept for backward compatibility';

-- ============================================================================
-- 4. CREATE VALIDATION FUNCTION FOR ACTIVE_TENANT_ID
-- ============================================================================

-- This function ensures active_tenant_id is always in the user's allowed tenants
CREATE OR REPLACE FUNCTION validate_active_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow NULL (user must select tenant)
  IF NEW.active_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verify active_tenant_id is in user_tenants
  IF NOT EXISTS (
    SELECT 1 FROM user_tenants
    WHERE user_id = NEW.id
      AND tenant_id = NEW.active_tenant_id
  ) THEN
    RAISE EXCEPTION 'active_tenant_id must be in user''s allowed tenants (user_tenants table)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS enforce_active_tenant_in_user_tenants ON users;
CREATE TRIGGER enforce_active_tenant_in_user_tenants
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_active_tenant();

COMMENT ON FUNCTION validate_active_tenant IS 'Ensures active_tenant_id is always in user_tenants table';

-- ============================================================================
-- 5. CREATE AUDIT LOG TABLE FOR TENANT SWITCHES (OPTIONAL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tenant_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_tenant_id UUID REFERENCES tenants(id),
  to_tenant_id UUID NOT NULL REFERENCES tenants(id),
  switched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_tenant_switches_user_id ON user_tenant_switches(user_id);
CREATE INDEX idx_tenant_switches_switched_at ON user_tenant_switches(switched_at DESC);

COMMENT ON TABLE user_tenant_switches IS 'Audit log for tenant switching (for security monitoring)';

-- ============================================================================
-- 6. UPDATE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Drop old tenant_isolation policy on users table
DROP POLICY IF EXISTS tenant_isolation ON users;

-- New policy: Check user_tenants + super_admin bypass
CREATE POLICY tenant_isolation ON users
  AS PERMISSIVE FOR ALL
  USING (
    -- Super admin sees all users
    (auth.jwt()->>'role') = 'super_admin'
    OR
    -- User can access their own record
    id = (auth.jwt()->>'sub')::uuid
    OR
    -- User can see users in tenants they belong to
    tenant_id IN (
      SELECT ut.tenant_id
      FROM user_tenants ut
      WHERE ut.user_id = (auth.jwt()->>'sub')::uuid
    )
    OR
    -- Match active tenant from PostgreSQL session variable
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- Update RLS for employees table
DROP POLICY IF EXISTS tenant_isolation ON employees;

CREATE POLICY tenant_isolation ON employees
  AS PERMISSIVE FOR ALL
  USING (
    (auth.jwt()->>'role') = 'super_admin'
    OR
    -- User can access employees in their tenants
    tenant_id IN (
      SELECT ut.tenant_id
      FROM user_tenants ut
      WHERE ut.user_id = (auth.jwt()->>'sub')::uuid
    )
    OR
    -- Match active tenant from session variable
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- Update RLS for locations table
DROP POLICY IF EXISTS tenant_isolation ON locations;

CREATE POLICY tenant_isolation ON locations
  AS PERMISSIVE FOR ALL
  USING (
    (auth.jwt()->>'role') = 'super_admin'
    OR
    tenant_id IN (
      SELECT ut.tenant_id
      FROM user_tenants ut
      WHERE ut.user_id = (auth.jwt()->>'sub')::uuid
    )
    OR
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- Update RLS for payroll_runs table
DROP POLICY IF EXISTS tenant_isolation ON payroll_runs;

CREATE POLICY tenant_isolation ON payroll_runs
  AS PERMISSIVE FOR ALL
  USING (
    (auth.jwt()->>'role') = 'super_admin'
    OR
    tenant_id IN (
      SELECT ut.tenant_id
      FROM user_tenants ut
      WHERE ut.user_id = (auth.jwt()->>'sub')::uuid
    )
    OR
    tenant_id = current_setting('app.tenant_id', true)::uuid
  );

-- ============================================================================
-- 7. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's available tenants
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_slug TEXT,
  user_role TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    ut.role
  FROM user_tenants ut
  JOIN tenants t ON ut.tenant_id = t.id
  WHERE ut.user_id = p_user_id
    AND t.status = 'active'
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenants IS 'Returns all active tenants a user has access to';

-- Function to log tenant switches
CREATE OR REPLACE FUNCTION log_tenant_switch(
  p_user_id UUID,
  p_from_tenant_id UUID,
  p_to_tenant_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_switch_id UUID;
BEGIN
  INSERT INTO user_tenant_switches (
    user_id,
    from_tenant_id,
    to_tenant_id,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_from_tenant_id,
    p_to_tenant_id,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_switch_id;

  RETURN v_switch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_tenant_switch IS 'Logs tenant switch for audit purposes';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check that all users have user_tenants records
-- SELECT
--   u.id,
--   u.email,
--   COUNT(ut.tenant_id) as tenant_count
-- FROM users u
-- LEFT JOIN user_tenants ut ON u.id = ut.user_id
-- GROUP BY u.id, u.email
-- HAVING COUNT(ut.tenant_id) = 0;
-- Expected: 0 rows (all users should have at least one tenant)

-- Check user_tenants table
-- SELECT COUNT(*) FROM user_tenants;
-- Expected: Equal to or greater than user count

-- Verify active_tenant_id constraint works
-- UPDATE users SET active_tenant_id = gen_random_uuid() WHERE id = (SELECT id FROM users LIMIT 1);
-- Expected: ERROR - constraint violation
