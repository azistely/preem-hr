-- Migration: Create daily_hours_entries table for manual daily hours tracking
-- Author: AI Assistant
-- Date: 2025-10-25
-- Description: Add support for manual daily hours entry, similar to variable pay inputs

-- Create daily_hours_entries table
CREATE TABLE IF NOT EXISTS daily_hours_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Period grouping (YYYY-MM-01 format)
  period DATE NOT NULL,

  -- Specific date worked (YYYY-MM-DD)
  entry_date DATE NOT NULL,

  -- Hours worked
  regular_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(5,2) DEFAULT 0,

  -- Entry classification
  entry_type TEXT NOT NULL DEFAULT 'regular', -- regular, overtime, night, weekend

  -- Location (optional - for multi-site support)
  location_id UUID, -- References locations(id)

  -- Status and approval
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Notes
  notes TEXT,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Unique constraint: one entry per employee per date
  CONSTRAINT unique_employee_date UNIQUE(tenant_id, employee_id, entry_date)
);

-- Add comment
COMMENT ON TABLE daily_hours_entries IS 'Manual daily hours tracking for employees (complementary to clock in/out system)';

-- Index for period-based queries (payroll calculation)
CREATE INDEX idx_daily_hours_period_sum ON daily_hours_entries(
  tenant_id,
  employee_id,
  period
);

-- Index for approval workflow
CREATE INDEX idx_daily_hours_status ON daily_hours_entries(tenant_id, status);

-- Index for date-based queries
CREATE INDEX idx_daily_hours_entry_date ON daily_hours_entries(tenant_id, entry_date);

-- RLS (Row Level Security) - Enable RLS
ALTER TABLE daily_hours_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation
CREATE POLICY tenant_isolation_daily_hours ON daily_hours_entries
  AS PERMISSIVE
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_hours_entries TO tenant_user;

-- Add updated_at trigger
CREATE TRIGGER update_daily_hours_entries_updated_at
  BEFORE UPDATE ON daily_hours_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
