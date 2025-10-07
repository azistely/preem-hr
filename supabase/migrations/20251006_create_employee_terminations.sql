-- Migration: Create employee_terminations table
-- Purpose: Track employee terminations with all terminal payments and documents
-- Compliance: Convention Collective Articles 35-40

-- Create terminations table
CREATE TABLE IF NOT EXISTS employee_terminations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Termination details
  termination_date DATE NOT NULL,
  termination_reason TEXT NOT NULL, -- 'dismissal', 'resignation', 'retirement', 'misconduct', 'contract_end'
  notes TEXT,

  -- Notice period
  notice_period_days INTEGER NOT NULL,
  notice_payment_amount DECIMAL(15,2),
  job_search_days_used INTEGER DEFAULT 0, -- Track 2 days/week usage

  -- Financial calculations
  severance_amount DECIMAL(15,2) DEFAULT 0,
  vacation_payout_amount DECIMAL(15,2) DEFAULT 0,
  average_salary_12m DECIMAL(15,2), -- For severance calculation
  years_of_service DECIMAL(5,2),
  severance_rate INTEGER, -- 30, 35, or 40

  -- Document generation tracking
  work_certificate_generated_at TIMESTAMPTZ,
  work_certificate_url TEXT,
  final_payslip_generated_at TIMESTAMPTZ,
  final_payslip_url TEXT,
  cnps_attestation_generated_at TIMESTAMPTZ,
  cnps_attestation_url TEXT,

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'notice_period', 'documents_pending', 'completed'

  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  updated_by_email TEXT,

  -- Constraints
  CONSTRAINT valid_termination_reason CHECK (
    termination_reason IN ('dismissal', 'resignation', 'retirement', 'misconduct', 'contract_end', 'death', 'other')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'notice_period', 'documents_pending', 'completed')
  ),
  CONSTRAINT positive_notice_period CHECK (notice_period_days >= 0),
  CONSTRAINT positive_severance CHECK (severance_amount >= 0),
  CONSTRAINT valid_severance_rate CHECK (severance_rate IN (0, 30, 35, 40))
);

-- Indexes for performance
CREATE INDEX idx_terminations_tenant ON employee_terminations(tenant_id);
CREATE INDEX idx_terminations_employee ON employee_terminations(employee_id);
CREATE INDEX idx_terminations_date ON employee_terminations(termination_date);
CREATE INDEX idx_terminations_status ON employee_terminations(status);

-- RLS policies
ALTER TABLE employee_terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for terminations"
  ON employee_terminations
  FOR ALL
  USING (tenant_id = (current_setting('app.current_tenant_id', TRUE))::UUID);

CREATE POLICY "Users can view terminations in their tenant"
  ON employee_terminations
  FOR SELECT
  USING (tenant_id = (current_setting('app.current_tenant_id', TRUE))::UUID);

CREATE POLICY "Users can create terminations in their tenant"
  ON employee_terminations
  FOR INSERT
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', TRUE))::UUID);

CREATE POLICY "Users can update terminations in their tenant"
  ON employee_terminations
  FOR UPDATE
  USING (tenant_id = (current_setting('app.current_tenant_id', TRUE))::UUID);

-- Trigger for updated_at
CREATE TRIGGER update_employee_terminations_updated_at
  BEFORE UPDATE ON employee_terminations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add termination tracking to employees table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'termination_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN termination_id UUID REFERENCES employee_terminations(id);
    CREATE INDEX idx_employees_termination ON employees(termination_id);
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE employee_terminations IS 'Tracks employee terminations with terminal payments and document generation status';
COMMENT ON COLUMN employee_terminations.notice_period_days IS 'Notice period in calendar days (8-90 days based on category)';
COMMENT ON COLUMN employee_terminations.severance_amount IS 'Indemnité de licenciement (30%/35%/40% based on seniority)';
COMMENT ON COLUMN employee_terminations.average_salary_12m IS 'Average monthly salary over last 12 months for severance calculation';
COMMENT ON COLUMN employee_terminations.work_certificate_url IS 'Certificat de Travail - must be generated within 48 hours';
COMMENT ON COLUMN employee_terminations.cnps_attestation_url IS 'CNPS attestation - must be generated within 15 days';
