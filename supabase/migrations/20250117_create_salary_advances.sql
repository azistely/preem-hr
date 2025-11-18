-- ============================================================================
-- Salary Advances Feature - Database Migration
-- ============================================================================
-- Created: 2025-01-17
-- Purpose: Create tables for salary advance management with approval workflow,
--          repayment tracking, and country-specific policies
-- Tables: salary_advances, salary_advance_repayments, salary_advance_policies
-- ============================================================================

-- ============================================================================
-- Table 1: salary_advances
-- Purpose: Main table for tracking all salary advance requests
-- ============================================================================

CREATE TABLE salary_advances (
  -- Primary & Relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Financial Details
  requested_amount NUMERIC(15, 2) NOT NULL,
  approved_amount NUMERIC(15, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'XOF',

  -- Repayment Configuration
  repayment_months INTEGER NOT NULL DEFAULT 1,
  monthly_deduction NUMERIC(15, 2),
  total_repaid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(15, 2),

  -- Request Details
  request_date TIMESTAMP NOT NULL DEFAULT NOW(),
  request_reason TEXT NOT NULL,
  request_notes TEXT,

  -- Approval Workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejected_reason TEXT,

  -- Payroll Integration
  first_deduction_month DATE,
  disbursement_date TIMESTAMP,
  disbursement_payroll_run_id UUID REFERENCES payroll_runs(id),

  -- Employee Snapshot (for audit)
  employee_net_salary_at_request NUMERIC(15, 2),
  employee_name VARCHAR(255),
  employee_number VARCHAR(50),

  -- Audit Trail
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_amount CHECK (requested_amount > 0),
  CONSTRAINT valid_repayment_months CHECK (repayment_months BETWEEN 1 AND 12),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'approved', 'disbursed', 'active', 'completed', 'rejected', 'cancelled')
  )
);

-- Comments for documentation
COMMENT ON TABLE salary_advances IS
'Salary advance requests with approval workflow and repayment tracking. Lifecycle: pending → approved → disbursed → active → completed (or rejected/cancelled)';

COMMENT ON COLUMN salary_advances.status IS
'Request lifecycle status: pending (awaiting approval), approved (ready for disbursement), disbursed (paid to employee), active (being repaid), completed (fully repaid), rejected (denied), cancelled (employee cancelled)';

COMMENT ON COLUMN salary_advances.first_deduction_month IS
'First month to start deducting repayment installments. Format: YYYY-MM-01';

COMMENT ON COLUMN salary_advances.employee_net_salary_at_request IS
'Snapshot of employee net salary at time of request for audit trail';

-- Indexes for performance
CREATE INDEX idx_salary_advances_tenant_employee
  ON salary_advances(tenant_id, employee_id);

CREATE INDEX idx_salary_advances_status
  ON salary_advances(tenant_id, status);

CREATE INDEX idx_salary_advances_deduction_month
  ON salary_advances(first_deduction_month)
  WHERE status IN ('active', 'disbursed');

CREATE INDEX idx_salary_advances_created_at
  ON salary_advances(created_at DESC);

CREATE INDEX idx_salary_advances_employee_number
  ON salary_advances(employee_number)
  WHERE employee_number IS NOT NULL;

-- ============================================================================
-- Table 2: salary_advance_repayments
-- Purpose: Track individual repayment installments for each advance
-- ============================================================================

CREATE TABLE salary_advance_repayments (
  -- Primary & Relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  salary_advance_id UUID NOT NULL REFERENCES salary_advances(id) ON DELETE CASCADE,

  -- Installment Details
  installment_number INTEGER NOT NULL,
  due_month DATE NOT NULL,
  planned_amount NUMERIC(15, 2) NOT NULL,

  -- Payment Tracking
  actual_amount NUMERIC(15, 2),
  paid_date TIMESTAMP,
  payroll_run_id UUID REFERENCES payroll_runs(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Notes
  notes TEXT,

  -- Audit Trail
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_installment_number CHECK (installment_number > 0),
  CONSTRAINT valid_planned_amount CHECK (planned_amount > 0),
  CONSTRAINT valid_repayment_status CHECK (
    status IN ('pending', 'paid', 'partial', 'missed', 'waived')
  )
);

-- Comments
COMMENT ON TABLE salary_advance_repayments IS
'Individual repayment installments for salary advances. Tracks planned vs actual deductions.';

COMMENT ON COLUMN salary_advance_repayments.status IS
'Installment status: pending (not yet deducted), paid (fully deducted), partial (employee left mid-month), missed (no payroll run), waived (manually waived by HR)';

COMMENT ON COLUMN salary_advance_repayments.due_month IS
'Month when installment should be deducted. Format: YYYY-MM-01';

-- Indexes
CREATE INDEX idx_advance_repayments_advance
  ON salary_advance_repayments(salary_advance_id);

CREATE INDEX idx_advance_repayments_due_month
  ON salary_advance_repayments(due_month)
  WHERE status = 'pending';

CREATE INDEX idx_advance_repayments_payroll_run
  ON salary_advance_repayments(payroll_run_id)
  WHERE payroll_run_id IS NOT NULL;

-- Unique constraint: one installment per number per advance
CREATE UNIQUE INDEX idx_advance_repayments_unique
  ON salary_advance_repayments(salary_advance_id, installment_number);

-- ============================================================================
-- Table 3: salary_advance_policies
-- Purpose: Country-specific and tenant-specific advance policies
-- ============================================================================

CREATE TABLE salary_advance_policies (
  -- Primary & Relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,

  -- Amount Limits
  max_percentage_of_net_salary NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
  max_absolute_amount NUMERIC(15, 2),
  min_advance_amount NUMERIC(15, 2) DEFAULT 10000,

  -- Request Limits
  max_outstanding_advances INTEGER DEFAULT 1,
  max_requests_per_month INTEGER DEFAULT 2,

  -- Eligibility Rules
  min_employment_months INTEGER DEFAULT 3,
  allowed_repayment_months INTEGER[] DEFAULT ARRAY[1, 2, 3],

  -- Workflow Configuration
  requires_manager_approval BOOLEAN DEFAULT TRUE,
  requires_hr_approval BOOLEAN DEFAULT TRUE,
  auto_approve_below_amount NUMERIC(15, 2),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Audit Trail
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_percentage CHECK (
    max_percentage_of_net_salary BETWEEN 0 AND 100
  ),
  CONSTRAINT valid_employment_months CHECK (min_employment_months >= 0),
  CONSTRAINT unique_tenant_country_policy UNIQUE (tenant_id, country_code, effective_from)
);

-- Comments
COMMENT ON TABLE salary_advance_policies IS
'Country-specific and tenant-specific salary advance policies. Defines limits, eligibility, and workflow rules.';

COMMENT ON COLUMN salary_advance_policies.max_percentage_of_net_salary IS
'Maximum advance as percentage of employee net salary (e.g., 30.00 = 30%). Default: 30% for CI/SN, 25% for BF';

COMMENT ON COLUMN salary_advance_policies.allowed_repayment_months IS
'Array of allowed repayment periods in months. Example: ARRAY[1,2,3] allows 1, 2, or 3 month repayment';

-- Indexes
CREATE INDEX idx_advance_policies_tenant
  ON salary_advance_policies(tenant_id, is_active);

CREATE INDEX idx_advance_policies_country
  ON salary_advance_policies(country_code);

CREATE INDEX idx_advance_policies_effective
  ON salary_advance_policies(effective_from, effective_to);

-- ============================================================================
-- Triggers: Auto-update updated_at timestamp
-- ============================================================================

-- Create or replace the trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all 3 tables
CREATE TRIGGER update_salary_advances_updated_at
  BEFORE UPDATE ON salary_advances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salary_advance_repayments_updated_at
  BEFORE UPDATE ON salary_advance_repayments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salary_advance_policies_updated_at
  BEFORE UPDATE ON salary_advance_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advance_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advance_policies ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for salary_advances
CREATE POLICY tenant_isolation ON salary_advances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Super admin bypass for salary_advances
CREATE POLICY super_admin_access ON salary_advances
  FOR ALL
  USING (
    current_setting('app.user_role', true) = 'super_admin'
  );

-- Tenant isolation policy for salary_advance_repayments
CREATE POLICY tenant_isolation ON salary_advance_repayments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Super admin bypass for salary_advance_repayments
CREATE POLICY super_admin_access ON salary_advance_repayments
  FOR ALL
  USING (
    current_setting('app.user_role', true) = 'super_admin'
  );

-- Tenant isolation policy for salary_advance_policies
CREATE POLICY tenant_isolation ON salary_advance_policies
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Super admin bypass for salary_advance_policies
CREATE POLICY super_admin_access ON salary_advance_policies
  FOR ALL
  USING (
    current_setting('app.user_role', true) = 'super_admin'
  );

-- ============================================================================
-- Seed Data: Default Policies for All Tenants
-- ============================================================================

-- Insert default policies for existing tenants
-- This ensures every tenant gets country-appropriate policies
INSERT INTO salary_advance_policies (
  tenant_id,
  country_code,
  max_percentage_of_net_salary,
  min_advance_amount,
  max_outstanding_advances,
  max_requests_per_month,
  min_employment_months,
  allowed_repayment_months,
  requires_manager_approval,
  requires_hr_approval,
  is_active
)
SELECT
  t.id as tenant_id,
  t.country_code,
  -- Max percentage varies by country
  CASE t.country_code
    WHEN 'CI' THEN 30.00  -- Côte d'Ivoire: 30%
    WHEN 'SN' THEN 30.00  -- Sénégal: 30%
    WHEN 'BF' THEN 25.00  -- Burkina Faso: 25%
    ELSE 30.00            -- Default: 30%
  END as max_percentage_of_net_salary,
  10000 as min_advance_amount,
  1 as max_outstanding_advances,
  2 as max_requests_per_month,
  -- Min employment months varies by country
  CASE t.country_code
    WHEN 'BF' THEN 6  -- Burkina Faso: 6 months
    ELSE 3            -- CI, SN: 3 months
  END as min_employment_months,
  -- Allowed repayment months varies by country
  CASE t.country_code
    WHEN 'BF' THEN ARRAY[1, 2]    -- Burkina: max 2 months
    ELSE ARRAY[1, 2, 3]            -- CI, SN: up to 3 months
  END as allowed_repayment_months,
  TRUE as requires_manager_approval,
  TRUE as requires_hr_approval,
  TRUE as is_active
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM salary_advance_policies p
  WHERE p.tenant_id = t.id
    AND p.country_code = t.country_code
    AND p.is_active = TRUE
);

-- ============================================================================
-- Grant Permissions (if using specific roles)
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON salary_advances TO authenticated;
GRANT SELECT, INSERT, UPDATE ON salary_advance_repayments TO authenticated;
GRANT SELECT ON salary_advance_policies TO authenticated;

-- HR/Admin can manage policies
GRANT ALL ON salary_advance_policies TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Add comment to migration tracking
COMMENT ON TABLE salary_advances IS
'[Migration: 20250117] Salary Advances Feature - Main tracking table';

COMMENT ON TABLE salary_advance_repayments IS
'[Migration: 20250117] Salary Advances Feature - Repayment installments';

COMMENT ON TABLE salary_advance_policies IS
'[Migration: 20250117] Salary Advances Feature - Country-specific policies';
