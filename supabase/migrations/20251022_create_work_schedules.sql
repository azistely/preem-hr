-- =====================================================
-- Work Schedules for Daily/Hourly Workers (GAP-JOUR-002)
-- =====================================================
--
-- This migration creates infrastructure for tracking variable work schedules
-- for daily and hourly workers (e.g., construction, retail, hospitality).
--
-- Features:
-- - Track days worked and hours per day
-- - Flexible schedule entry (full day, partial day, absent)
-- - Approval workflow (employee submits, manager approves)
-- - Monthly totals for payroll integration
-- - Multi-tenant with RLS
--
-- Related to:
-- - time_entries: Clock in/out for full-time workers
-- - payroll: Integration point for calculating daily/hourly pay
-- =====================================================

-- ========================================
-- 1. Work Schedules Table
-- ========================================

CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Work date (single day)
  work_date DATE NOT NULL,

  -- Time tracking (optional for hourly workers)
  start_time TIME,
  end_time TIME,

  -- Hours worked (can be auto-calculated from times or manually entered)
  hours_worked NUMERIC(5, 2), -- e.g., 8.00, 4.50, 10.25

  -- Attendance status
  is_present BOOLEAN NOT NULL DEFAULT false,

  -- Schedule type for quick filtering/display
  schedule_type VARCHAR(20) NOT NULL DEFAULT 'FULL_DAY',
  -- Values: 'FULL_DAY' (8h), 'PARTIAL_DAY' (custom hours), 'ABSENT' (0h)

  -- Optional notes
  notes TEXT,

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Values: 'draft', 'pending', 'approved', 'rejected'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,

  -- Week grouping for bulk approval
  week_start_date DATE, -- Monday of the week (for grouping)

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT work_schedules_unique_employee_date UNIQUE(tenant_id, employee_id, work_date),
  CONSTRAINT work_schedules_valid_hours CHECK (hours_worked IS NULL OR (hours_worked >= 0 AND hours_worked <= 24)),
  CONSTRAINT work_schedules_valid_type CHECK (schedule_type IN ('FULL_DAY', 'PARTIAL_DAY', 'ABSENT')),
  CONSTRAINT work_schedules_valid_status CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  CONSTRAINT work_schedules_time_consistency CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL)
  )
);

-- ========================================
-- 2. Indexes for Performance
-- ========================================

-- Tenant isolation (required for RLS)
CREATE INDEX idx_work_schedules_tenant ON work_schedules(tenant_id);

-- Employee schedules (most common query)
CREATE INDEX idx_work_schedules_employee ON work_schedules(employee_id, work_date DESC);

-- Date range queries (payroll month)
CREATE INDEX idx_work_schedules_date ON work_schedules(work_date);

-- Approval workflow (manager dashboard)
CREATE INDEX idx_work_schedules_status ON work_schedules(tenant_id, status, work_date DESC)
  WHERE status IN ('pending', 'draft');

-- Week grouping (bulk approval)
CREATE INDEX idx_work_schedules_week ON work_schedules(tenant_id, employee_id, week_start_date)
  WHERE week_start_date IS NOT NULL;

-- Combined index for payroll integration (month totals)
CREATE INDEX idx_work_schedules_payroll ON work_schedules(tenant_id, employee_id, work_date)
  WHERE status = 'approved';

-- ========================================
-- 3. Row-Level Security (RLS)
-- ========================================

ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant Isolation
-- Employees can view/edit their own schedules
-- Managers can view/approve team schedules
-- HR can view/approve all schedules
CREATE POLICY work_schedules_tenant_isolation ON work_schedules
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- ========================================
-- 4. Helper Functions
-- ========================================

-- Function: Calculate week start date (Monday) from any date
CREATE OR REPLACE FUNCTION get_week_start_date(input_date DATE)
RETURNS DATE AS $$
BEGIN
  -- Extract ISO week start (Monday)
  RETURN input_date - ((EXTRACT(ISODOW FROM input_date)::INTEGER - 1) || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_week_start_date IS 'Returns the Monday of the week for any given date (ISO week starting Monday)';

-- Function: Auto-calculate week_start_date on insert/update
CREATE OR REPLACE FUNCTION work_schedules_set_week_start()
RETURNS TRIGGER AS $$
BEGIN
  NEW.week_start_date := get_week_start_date(NEW.work_date);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-calculate week_start_date
CREATE TRIGGER work_schedules_before_insert_update
  BEFORE INSERT OR UPDATE ON work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION work_schedules_set_week_start();

-- Function: Auto-calculate hours_worked from start_time and end_time
CREATE OR REPLACE FUNCTION work_schedules_calculate_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-calculate if both times are provided but hours_worked is not
  IF NEW.start_time IS NOT NULL
     AND NEW.end_time IS NOT NULL
     AND NEW.hours_worked IS NULL THEN

    -- Calculate duration in hours (handles overnight shifts)
    NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;

    -- Handle overnight shifts (end_time < start_time)
    IF NEW.hours_worked < 0 THEN
      NEW.hours_worked := NEW.hours_worked + 24;
    END IF;

    -- Round to 2 decimal places
    NEW.hours_worked := ROUND(NEW.hours_worked, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-calculate hours from times (runs before week_start trigger)
CREATE TRIGGER work_schedules_before_calculate_hours
  BEFORE INSERT OR UPDATE ON work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION work_schedules_calculate_hours();

-- Function: Get monthly work totals for an employee
CREATE OR REPLACE FUNCTION get_work_schedule_totals(
  p_employee_id UUID,
  p_tenant_id UUID,
  p_month_start DATE,
  p_month_end DATE
)
RETURNS TABLE(
  days_worked INTEGER,
  total_hours NUMERIC,
  pending_days INTEGER,
  approved_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER AS days_worked,
    COALESCE(SUM(hours_worked), 0)::NUMERIC AS total_hours,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER AS pending_days,
    COUNT(*) FILTER (WHERE status = 'approved')::INTEGER AS approved_days
  FROM work_schedules
  WHERE
    employee_id = p_employee_id
    AND tenant_id = p_tenant_id
    AND work_date >= p_month_start
    AND work_date <= p_month_end
    AND is_present = true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_work_schedule_totals IS 'Calculate monthly work totals for payroll integration. Only counts days where is_present = true.';

-- ========================================
-- 5. Updated At Trigger
-- ========================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION work_schedules_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_schedules_update_timestamp_trigger
  BEFORE UPDATE ON work_schedules
  FOR EACH ROW
  EXECUTE FUNCTION work_schedules_update_timestamp();

-- ========================================
-- 6. Comments for Documentation
-- ========================================

COMMENT ON TABLE work_schedules IS 'Variable work schedules for daily/hourly workers. Tracks days/hours worked per week/month with approval workflow.';
COMMENT ON COLUMN work_schedules.schedule_type IS 'FULL_DAY (8h standard), PARTIAL_DAY (custom hours), ABSENT (not working)';
COMMENT ON COLUMN work_schedules.status IS 'draft (being edited), pending (submitted for approval), approved (confirmed), rejected (denied)';
COMMENT ON COLUMN work_schedules.week_start_date IS 'Auto-calculated Monday of the week. Used for grouping weekly submissions.';
COMMENT ON COLUMN work_schedules.is_present IS 'Whether employee was present. False for ABSENT type, true for FULL_DAY/PARTIAL_DAY.';
COMMENT ON COLUMN work_schedules.hours_worked IS 'Hours worked that day. Auto-calculated from start_time/end_time if provided, or manually entered.';

-- ========================================
-- 7. Grant Permissions
-- ========================================

-- Grant access to tenant_user role
GRANT SELECT, INSERT, UPDATE, DELETE ON work_schedules TO tenant_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tenant_user;
