/**
 * Job Search Days Tracking
 *
 * Convention Collective Article 40:
 * During notice period, employee entitled to 2 days/week for job search
 * Must be tracked and validated by employer
 */

-- Table to track job search days during notice period
CREATE TABLE IF NOT EXISTS job_search_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  termination_id UUID NOT NULL REFERENCES employee_terminations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Job search day details
  search_date DATE NOT NULL,
  day_type VARCHAR(20) NOT NULL CHECK (day_type IN ('full_day', 'half_day')),
  hours_taken DECIMAL(4,2) NOT NULL DEFAULT 8.00, -- Hours taken for job search

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Notes
  notes TEXT, -- Employee can add notes about interviews, etc.

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT unique_search_date_per_termination UNIQUE (termination_id, search_date)
);

-- Indexes for performance
CREATE INDEX idx_job_search_days_tenant ON job_search_days(tenant_id);
CREATE INDEX idx_job_search_days_termination ON job_search_days(termination_id);
CREATE INDEX idx_job_search_days_employee ON job_search_days(employee_id);
CREATE INDEX idx_job_search_days_date ON job_search_days(search_date);
CREATE INDEX idx_job_search_days_status ON job_search_days(status);

-- RLS Policies
ALTER TABLE job_search_days ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY job_search_days_tenant_isolation ON job_search_days
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Updated timestamp trigger
CREATE TRIGGER update_job_search_days_updated_at
  BEFORE UPDATE ON job_search_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE job_search_days IS 'Tracks job search days taken during notice period (Convention Collective Article 40: 2 days/week)';
COMMENT ON COLUMN job_search_days.day_type IS 'full_day = 8 hours, half_day = 4 hours';
COMMENT ON COLUMN job_search_days.hours_taken IS 'Actual hours taken for job search (default: 8 for full day, 4 for half day)';
COMMENT ON COLUMN job_search_days.status IS 'Approval status: pending, approved, rejected';
