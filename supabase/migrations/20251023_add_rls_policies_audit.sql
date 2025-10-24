/**
 * Add RLS Policies - Audit Implementation
 *
 * Purpose: Add Row-Level Security policies to tables identified in audit report
 * Priority: P1 - Security Risk (tenant isolation)
 *
 * Tables to secure:
 * 1. All tenant-specific tables must have RLS enabled
 * 2. Policies must include super_admin bypass
 * 3. JOIN-based policies for tables without direct tenant_id
 *
 * Note: Most tables already have RLS defined in Drizzle schema.
 * This migration ensures they're actually enabled in the database.
 */

-- ============================================================================
-- VERIFY EXISTING RLS STATUS
-- ============================================================================

-- Enable RLS on all tenant-specific tables (idempotent)
-- These may already have RLS from Drizzle, but we ensure it's enabled

ALTER TABLE IF EXISTS payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payslip_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gl_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_off_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_executions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE/REPLACE RLS POLICIES (Tables with direct tenant_id)
-- ============================================================================

-- Pattern: Allow access if user's tenant matches OR user is super_admin
-- This follows the exact pattern from Drizzle schema files

-- 1. PAYROLL_RUNS
DROP POLICY IF EXISTS tenant_isolation ON payroll_runs;
CREATE POLICY tenant_isolation ON payroll_runs
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 2. PAYROLL_LINE_ITEMS
DROP POLICY IF EXISTS tenant_isolation ON payroll_line_items;
CREATE POLICY tenant_isolation ON payroll_line_items
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 3. PAYSLIP_TEMPLATES
DROP POLICY IF EXISTS tenant_isolation ON payslip_templates;
CREATE POLICY tenant_isolation ON payslip_templates
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 4. GL_EXPORTS (accounting_exports in audit report)
DROP POLICY IF EXISTS tenant_isolation ON gl_exports;
CREATE POLICY tenant_isolation ON gl_exports
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 5. WORK_SCHEDULES
DROP POLICY IF EXISTS tenant_isolation ON work_schedules;
CREATE POLICY tenant_isolation ON work_schedules
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 6. TIME_ENTRIES
DROP POLICY IF EXISTS tenant_isolation ON time_entries;
CREATE POLICY tenant_isolation ON time_entries
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 7. TIME_OFF_BALANCES (leave_balances in audit report)
DROP POLICY IF EXISTS tenant_isolation ON time_off_balances;
CREATE POLICY tenant_isolation ON time_off_balances
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 8. TIME_OFF_REQUESTS (leave_requests in audit report)
DROP POLICY IF EXISTS tenant_isolation ON time_off_requests;
CREATE POLICY tenant_isolation ON time_off_requests
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 9. AUDIT_LOGS (Critical - prevent cross-tenant audit access)
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 10. EVENTS
DROP POLICY IF EXISTS tenant_isolation ON events;
CREATE POLICY tenant_isolation ON events
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 11. WORKFLOW_DEFINITIONS
DROP POLICY IF EXISTS workflow_definitions_tenant_isolation ON workflow_definitions;
CREATE POLICY workflow_definitions_tenant_isolation ON workflow_definitions
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- 12. WORKFLOW_EXECUTIONS
DROP POLICY IF EXISTS workflow_executions_tenant_isolation ON workflow_executions;
CREATE POLICY workflow_executions_tenant_isolation ON workflow_executions
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled (run separately after migration)
/*
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'payroll_runs',
    'payroll_line_items',
    'payslip_templates',
    'gl_exports',
    'work_schedules',
    'time_entries',
    'time_off_balances',
    'time_off_requests',
    'audit_logs',
    'events',
    'workflow_definitions',
    'workflow_executions'
)
ORDER BY tablename;

-- Verify policies exist
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'payroll_runs',
    'payroll_line_items',
    'payslip_templates',
    'gl_exports',
    'work_schedules',
    'time_entries',
    'time_off_balances',
    'time_off_requests',
    'audit_logs',
    'events',
    'workflow_definitions',
    'workflow_executions'
)
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Tables Secured: 12 tables
-- Security Level: Tenant isolation with super_admin bypass
-- Breaking Changes: None (policies are permissive)
-- Rollback: DROP POLICY ... ; ALTER TABLE ... DISABLE ROW LEVEL SECURITY;
-- Testing: Verify cross-tenant data is not accessible via JWT context
