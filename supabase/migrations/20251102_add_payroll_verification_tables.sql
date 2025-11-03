-- Migration: Add payroll verification and validation tables
-- Description: Support for payroll review workflow with verification status tracking and validation issue detection
-- Date: 2025-11-02

-- Table: payroll_verification_status
-- Purpose: Track verification status per employee in each payroll run
CREATE TABLE IF NOT EXISTS payroll_verification_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('verified', 'flagged', 'unverified', 'auto_ok')),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);

-- Table: payroll_validation_issues
-- Purpose: Store detected validation issues (overtime missing, unusual variances, etc.)
CREATE TABLE IF NOT EXISTS payroll_validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('error', 'warning', 'info')),
  category TEXT NOT NULL CHECK (category IN ('overtime', 'comparison', 'prorata', 'deduction', 'bonus')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  expected_amount NUMERIC(15, 2),
  actual_amount NUMERIC(15, 2),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_verification_status_run ON payroll_verification_status(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_verification_status_employee ON payroll_verification_status(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_verification_status_tenant ON payroll_verification_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_verification_status_status ON payroll_verification_status(status);

CREATE INDEX IF NOT EXISTS idx_payroll_validation_issues_run ON payroll_validation_issues(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_validation_issues_employee ON payroll_validation_issues(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_validation_issues_tenant ON payroll_validation_issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_validation_issues_type ON payroll_validation_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_payroll_validation_issues_resolved ON payroll_validation_issues(resolved);

-- Row Level Security (RLS) Policies
ALTER TABLE payroll_verification_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_validation_issues ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation ON payroll_verification_status
  FOR ALL
  TO public
  USING (
    (tenant_id::text = (auth.jwt() ->> 'tenant_id'::text))
    OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text)
  )
  WITH CHECK (tenant_id::text = (auth.jwt() ->> 'tenant_id'::text));

CREATE POLICY tenant_isolation ON payroll_validation_issues
  FOR ALL
  TO public
  USING (
    (tenant_id::text = (auth.jwt() ->> 'tenant_id'::text))
    OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text)
  )
  WITH CHECK (tenant_id::text = (auth.jwt() ->> 'tenant_id'::text));

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_payroll_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payroll_verification_status_updated_at
  BEFORE UPDATE ON payroll_verification_status
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_verification_updated_at();

CREATE TRIGGER update_payroll_validation_issues_updated_at
  BEFORE UPDATE ON payroll_validation_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_verification_updated_at();

-- Comments for documentation
COMMENT ON TABLE payroll_verification_status IS 'Tracks HR manager verification status for each employee in a payroll run';
COMMENT ON TABLE payroll_validation_issues IS 'Stores auto-detected validation issues (overtime missing, unusual variances, prorata alerts)';
COMMENT ON COLUMN payroll_verification_status.status IS 'verified: manually checked, flagged: has issues, unverified: not reviewed, auto_ok: auto-verified (no issues + <5% variance)';
COMMENT ON COLUMN payroll_validation_issues.category IS 'overtime: missing OT calculation, comparison: month-over-month variance, prorata: first/last month calculation, deduction: anomaly in contributions, bonus: large bonus alert';
