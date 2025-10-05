-- Enable Row Level Security (RLS) for tenant isolation
-- Migration: 20250105_enable_rls_policies.sql
-- Purpose: Implement RLS policies to ensure data isolation between tenants

-- =============================================================================
-- EMPLOYEES TABLE
-- =============================================================================

-- Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "tenant_isolation" ON employees;

-- Create tenant isolation policy for employees
-- Tenant users can only access employees from their own tenant
-- Super admins have access to all tenants
CREATE POLICY "tenant_isolation" ON employees
  AS PERMISSIVE
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- =============================================================================
-- PAYROLL RUNS TABLE
-- =============================================================================

-- Enable RLS on payroll_runs table
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "payroll_runs_tenant_isolation" ON payroll_runs;

-- Create tenant isolation policy for payroll runs
CREATE POLICY "payroll_runs_tenant_isolation" ON payroll_runs
  AS PERMISSIVE
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- =============================================================================
-- PAYROLL LINE ITEMS TABLE
-- =============================================================================

-- Enable RLS on payroll_line_items table
ALTER TABLE payroll_line_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "payroll_line_items_tenant_isolation" ON payroll_line_items;

-- Create tenant isolation policy for payroll line items
CREATE POLICY "payroll_line_items_tenant_isolation" ON payroll_line_items
  AS PERMISSIVE
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- =============================================================================
-- EMPLOYEE SALARIES TABLE
-- =============================================================================

-- Enable RLS on employee_salaries table
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "employee_salaries_tenant_isolation" ON employee_salaries;

-- Create tenant isolation policy for employee salaries
-- Note: employee_salaries doesn't have direct tenant_id, so we join with employees
CREATE POLICY "employee_salaries_tenant_isolation" ON employee_salaries
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = employee_salaries.employee_id
        AND employees.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- =============================================================================
-- INDEXES FOR RLS PERFORMANCE
-- =============================================================================

-- Create indexes on tenant_id columns for better RLS query performance
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant_id ON payroll_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_tenant_id ON payroll_line_items(tenant_id);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify RLS is enabled (for manual verification)
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('employees', 'payroll_runs', 'payroll_line_items', 'employee_salaries')
--   AND schemaname = 'public';

-- View all policies (for manual verification)
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('employees', 'payroll_runs', 'payroll_line_items', 'employee_salaries')
-- ORDER BY tablename, policyname;
