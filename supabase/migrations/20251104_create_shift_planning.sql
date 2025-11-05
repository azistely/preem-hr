-- =====================================================
-- Shift Planning System Migration
-- Feature: GAP-SHIFT-001
-- Created: 2025-11-04
-- =====================================================
--
-- Creates tables for proactive shift planning and scheduling:
-- 1. shift_templates - Reusable shift definitions
-- 2. planned_shifts - Future shift assignments
-- 3. shift_swap_requests - Employee shift trading
-- 4. shift_coverage_requirements - Staffing rules
--
-- Integrates with:
-- - employees (shift assignments)
-- - employment_contracts (determines pay calculation)
-- - work_schedules (reconciliation of planned vs actual)
-- - time_entries (clock in/out tracking)
-- - time_off_requests (conflict detection)
--
-- =====================================================

-- =====================================================
-- TABLE 1: shift_templates
-- =====================================================

CREATE TABLE shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Template identification
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50),
  color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for UI

  -- Shift timing
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC(5,2), -- Auto-calculated

  -- Break time (unpaid)
  break_minutes INTEGER DEFAULT 0,
  paid_hours NUMERIC(5,2), -- Auto-calculated: duration - break/60

  -- Shift metadata
  shift_type VARCHAR(20) NOT NULL DEFAULT 'regular',
  -- Values: 'regular', 'overtime', 'night', 'weekend', 'on_call'

  -- Applicability filters
  applicable_departments UUID[], -- NULL = all departments
  applicable_positions UUID[], -- NULL = all positions
  applicable_sectors VARCHAR(50)[], -- NULL = all sectors

  -- Capacity planning
  min_employees INTEGER DEFAULT 1,
  max_employees INTEGER, -- NULL = unlimited

  -- Legal compliance
  requires_rest_period BOOLEAN DEFAULT true,
  min_rest_hours INTEGER DEFAULT 11, -- CI labor law
  max_consecutive_days INTEGER DEFAULT 6, -- CI labor law

  -- Cost metadata
  overtime_multiplier NUMERIC(4,2) DEFAULT 1.00,

  -- Notes
  description TEXT,
  notes TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT shift_end_after_start CHECK (
    end_time > start_time OR shift_type IN ('night', 'overnight')
  ),
  CONSTRAINT valid_duration CHECK (
    duration_hours IS NULL OR (duration_hours > 0 AND duration_hours <= 24)
  ),
  CONSTRAINT valid_break CHECK (
    break_minutes >= 0 AND break_minutes < 1440
  ),
  CONSTRAINT valid_capacity CHECK (
    max_employees IS NULL OR max_employees >= min_employees
  )
);

-- Indexes
CREATE INDEX idx_shift_templates_tenant ON shift_templates(tenant_id);
CREATE INDEX idx_shift_templates_active ON shift_templates(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_shift_templates_type ON shift_templates(shift_type);

-- RLS
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON shift_templates
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) OR current_setting('app.bypass_rls', true)::boolean = true);

-- =====================================================
-- TABLE 2: planned_shifts
-- =====================================================

CREATE TABLE planned_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Assignment
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,

  -- Schedule date
  shift_date DATE NOT NULL,

  -- Timing (from template, can be overridden)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,

  -- Calculated fields
  duration_hours NUMERIC(5,2) NOT NULL,
  paid_hours NUMERIC(5,2) NOT NULL,

  -- Location (multi-site support)
  location_id UUID REFERENCES locations(id),

  -- Context (denormalized for performance)
  department_id UUID REFERENCES departments(id),
  position_id UUID REFERENCES positions(id),

  -- Contract context (critical for cost calculation)
  contract_id UUID REFERENCES employment_contracts(id),
  contract_type VARCHAR(20), -- Denormalized: CDI, CDD, CDDTI, etc.

  -- Shift metadata
  shift_type VARCHAR(20) NOT NULL DEFAULT 'regular',
  -- Values: 'regular', 'overtime', 'night', 'weekend', 'on_call'

  -- Cost calculation
  overtime_multiplier NUMERIC(4,2) DEFAULT 1.00,
  estimated_cost NUMERIC(15,2), -- Calculated based on contract type

  -- Status workflow
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Values: 'draft', 'published', 'confirmed', 'completed', 'cancelled', 'no_show'

  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id),

  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES users(id),

  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,

  -- Actual attendance (reconciliation)
  actual_clock_in TIMESTAMPTZ,
  actual_clock_out TIMESTAMPTZ,
  actual_hours NUMERIC(5,2),
  attendance_status VARCHAR(20), -- 'scheduled', 'present', 'absent', 'late', 'early_departure'

  work_schedule_id UUID REFERENCES work_schedules(id),
  time_entry_id UUID REFERENCES time_entries(id),

  -- Conflict tracking
  has_conflicts BOOLEAN DEFAULT false,
  conflict_types TEXT[], -- ['overlapping_shift', 'time_off', 'rest_period_violation']

  -- Notes
  notes TEXT,
  employee_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT unique_employee_shift_time UNIQUE (tenant_id, employee_id, shift_date, start_time),
  CONSTRAINT valid_shift_times CHECK (
    end_time > start_time OR shift_type IN ('night', 'overnight')
  ),
  CONSTRAINT valid_hours CHECK (
    duration_hours > 0 AND paid_hours >= 0 AND paid_hours <= duration_hours
  )
);

-- Indexes for performance
CREATE INDEX idx_planned_shifts_tenant ON planned_shifts(tenant_id);
CREATE INDEX idx_planned_shifts_employee ON planned_shifts(employee_id);
CREATE INDEX idx_planned_shifts_date ON planned_shifts(shift_date);
CREATE INDEX idx_planned_shifts_employee_date ON planned_shifts(employee_id, shift_date);
CREATE INDEX idx_planned_shifts_status ON planned_shifts(status) WHERE status IN ('published', 'confirmed');
CREATE INDEX idx_planned_shifts_department_date ON planned_shifts(department_id, shift_date);
CREATE INDEX idx_planned_shifts_template ON planned_shifts(shift_template_id);
CREATE INDEX idx_planned_shifts_conflicts ON planned_shifts(has_conflicts) WHERE has_conflicts = true;
CREATE INDEX idx_planned_shifts_contract ON planned_shifts(contract_id);

-- RLS
ALTER TABLE planned_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON planned_shifts
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) OR current_setting('app.bypass_rls', true)::boolean = true);

-- =====================================================
-- TABLE 3: shift_swap_requests
-- =====================================================

CREATE TABLE shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Original shift being swapped
  original_shift_id UUID NOT NULL REFERENCES planned_shifts(id) ON DELETE CASCADE,
  original_employee_id UUID NOT NULL REFERENCES employees(id),

  -- Target employee
  target_employee_id UUID REFERENCES employees(id), -- NULL = open to any employee

  -- Offered shift in return (optional)
  offered_shift_id UUID REFERENCES planned_shifts(id) ON DELETE SET NULL,

  -- Swap type
  swap_type VARCHAR(20) NOT NULL DEFAULT 'bilateral',
  -- Values: 'bilateral' (1-for-1), 'unilateral' (give away), 'pickup' (take unclaimed)

  -- Request details
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID NOT NULL REFERENCES users(id),

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Values: 'pending', 'target_accepted', 'manager_approved', 'approved', 'rejected', 'cancelled', 'expired'

  target_response VARCHAR(20),
  target_response_at TIMESTAMPTZ,
  target_response_notes TEXT,

  manager_response VARCHAR(20),
  manager_response_at TIMESTAMPTZ,
  manager_response_by UUID REFERENCES users(id),
  manager_response_notes TEXT,

  -- Expiry
  expires_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shift_swaps_tenant ON shift_swap_requests(tenant_id);
CREATE INDEX idx_shift_swaps_original_employee ON shift_swap_requests(original_employee_id);
CREATE INDEX idx_shift_swaps_target_employee ON shift_swap_requests(target_employee_id);
CREATE INDEX idx_shift_swaps_status ON shift_swap_requests(status) WHERE status = 'pending';
CREATE INDEX idx_shift_swaps_original_shift ON shift_swap_requests(original_shift_id);

-- RLS
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON shift_swap_requests
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) OR current_setting('app.bypass_rls', true)::boolean = true);

-- =====================================================
-- TABLE 4: shift_coverage_requirements
-- =====================================================

CREATE TABLE shift_coverage_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Scope
  department_id UUID REFERENCES departments(id), -- NULL = company-wide
  location_id UUID REFERENCES locations(id), -- NULL = all locations
  position_id UUID REFERENCES positions(id), -- NULL = any position

  -- Time scope
  day_of_week INTEGER, -- 0=Sunday, 6=Saturday, NULL = all days
  start_date DATE,
  end_date DATE,

  -- Time period within day
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- Staffing requirements
  min_employees INTEGER NOT NULL DEFAULT 1,
  max_employees INTEGER,
  optimal_employees INTEGER,

  -- Skill requirements
  required_skills TEXT[],

  -- Priority
  priority INTEGER DEFAULT 1, -- 1-5, higher = more important

  -- Notes
  description TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_day_of_week CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT valid_staffing CHECK (
    (max_employees IS NULL OR max_employees >= min_employees) AND
    (optimal_employees IS NULL OR optimal_employees >= min_employees)
  ),
  CONSTRAINT valid_priority CHECK (priority >= 1 AND priority <= 5)
);

-- Indexes
CREATE INDEX idx_coverage_req_tenant ON shift_coverage_requirements(tenant_id);
CREATE INDEX idx_coverage_req_department ON shift_coverage_requirements(department_id);
CREATE INDEX idx_coverage_req_date ON shift_coverage_requirements(start_date, end_date);
CREATE INDEX idx_coverage_req_active ON shift_coverage_requirements(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE shift_coverage_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON shift_coverage_requirements
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true) OR current_setting('app.bypass_rls', true)::boolean = true);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Function: Calculate shift template duration
CREATE OR REPLACE FUNCTION calculate_shift_template_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate duration in hours
  IF NEW.end_time > NEW.start_time THEN
    NEW.duration_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
  ELSE
    -- Overnight shift (e.g., 22:00 to 06:00)
    NEW.duration_hours := EXTRACT(EPOCH FROM ((NEW.end_time + INTERVAL '24 hours') - NEW.start_time)) / 3600;
  END IF;

  -- Calculate paid hours (subtract break)
  NEW.paid_hours := NEW.duration_hours - (COALESCE(NEW.break_minutes, 0) / 60.0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_shift_template_duration
  BEFORE INSERT OR UPDATE ON shift_templates
  FOR EACH ROW
  EXECUTE FUNCTION calculate_shift_template_duration();

-- Function: Calculate planned shift hours
CREATE OR REPLACE FUNCTION calculate_planned_shift_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate duration
  IF NEW.end_time > NEW.start_time THEN
    NEW.duration_hours := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600;
  ELSE
    NEW.duration_hours := EXTRACT(EPOCH FROM ((NEW.end_time + INTERVAL '24 hours') - NEW.start_time)) / 3600;
  END IF;

  -- Calculate paid hours
  NEW.paid_hours := NEW.duration_hours - (COALESCE(NEW.break_minutes, 0) / 60.0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_planned_shift_hours
  BEFORE INSERT OR UPDATE ON planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION calculate_planned_shift_hours();

-- Function: Check shift conflicts
CREATE OR REPLACE FUNCTION check_shift_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  v_conflicts TEXT[] := '{}';
  v_overlapping_count INTEGER;
  v_time_off_count INTEGER;
  v_last_shift_end TIMESTAMPTZ;
  v_hours_rest NUMERIC;
BEGIN
  -- Reset conflicts
  NEW.has_conflicts := false;
  NEW.conflict_types := '{}';

  -- Skip conflict check for cancelled shifts
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Check 1: Overlapping shifts for same employee on same day
  SELECT COUNT(*)
  INTO v_overlapping_count
  FROM planned_shifts ps
  WHERE ps.tenant_id = NEW.tenant_id
    AND ps.employee_id = NEW.employee_id
    AND ps.shift_date = NEW.shift_date
    AND ps.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ps.status NOT IN ('cancelled', 'no_show')
    AND (
      -- Time ranges overlap (simplified check for same day)
      (ps.start_time, ps.end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    );

  IF v_overlapping_count > 0 THEN
    v_conflicts := array_append(v_conflicts, 'overlapping_shift');
  END IF;

  -- Check 2: Approved time off
  SELECT COUNT(*)
  INTO v_time_off_count
  FROM time_off_requests tor
  WHERE tor.tenant_id = NEW.tenant_id
    AND tor.employee_id = NEW.employee_id
    AND tor.status = 'approved'
    AND NEW.shift_date BETWEEN tor.start_date AND tor.end_date;

  IF v_time_off_count > 0 THEN
    v_conflicts := array_append(v_conflicts, 'time_off');
  END IF;

  -- Check 3: Minimum rest period (11 hours in CI)
  -- Find the most recent shift before this one
  SELECT MAX(ps.shift_date + ps.end_time)
  INTO v_last_shift_end
  FROM planned_shifts ps
  WHERE ps.tenant_id = NEW.tenant_id
    AND ps.employee_id = NEW.employee_id
    AND (
      ps.shift_date < NEW.shift_date
      OR (ps.shift_date = NEW.shift_date AND ps.end_time < NEW.start_time)
    )
    AND ps.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ps.status NOT IN ('cancelled', 'no_show');

  IF v_last_shift_end IS NOT NULL THEN
    v_hours_rest := EXTRACT(EPOCH FROM ((NEW.shift_date + NEW.start_time) - v_last_shift_end)) / 3600;

    IF v_hours_rest < 11 THEN
      v_conflicts := array_append(v_conflicts, 'rest_period_violation');
    END IF;
  END IF;

  -- Set conflict flags
  IF array_length(v_conflicts, 1) > 0 THEN
    NEW.has_conflicts := true;
    NEW.conflict_types := v_conflicts;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_shift_conflicts
  BEFORE INSERT OR UPDATE ON planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION check_shift_conflicts();

-- Function: Update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_shift_templates_timestamp
  BEFORE UPDATE ON shift_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_update_planned_shifts_timestamp
  BEFORE UPDATE ON planned_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_update_shift_swaps_timestamp
  BEFORE UPDATE ON shift_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_update_coverage_timestamp
  BEFORE UPDATE ON shift_coverage_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get weekly schedule summary
CREATE OR REPLACE FUNCTION get_weekly_schedule_summary(
  p_tenant_id UUID,
  p_week_start_date DATE,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  shift_date DATE,
  total_shifts BIGINT,
  published_shifts BIGINT,
  confirmed_shifts BIGINT,
  total_hours NUMERIC,
  employees_scheduled BIGINT,
  has_conflicts BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.shift_date,
    COUNT(*) AS total_shifts,
    COUNT(*) FILTER (WHERE ps.status IN ('published', 'confirmed')) AS published_shifts,
    COUNT(*) FILTER (WHERE ps.status = 'confirmed') AS confirmed_shifts,
    SUM(ps.paid_hours) AS total_hours,
    COUNT(DISTINCT ps.employee_id) AS employees_scheduled,
    bool_or(ps.has_conflicts) AS has_conflicts
  FROM planned_shifts ps
  WHERE ps.tenant_id = p_tenant_id
    AND ps.shift_date BETWEEN p_week_start_date AND (p_week_start_date + INTERVAL '6 days')::DATE
    AND (p_department_id IS NULL OR ps.department_id = p_department_id)
    AND ps.status != 'cancelled'
  GROUP BY ps.shift_date
  ORDER BY ps.shift_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE shift_templates IS 'Reusable shift definitions (Morning, Night, Weekend shifts, etc.)';
COMMENT ON TABLE planned_shifts IS 'Future shift assignments linking employees to shifts on specific dates';
COMMENT ON TABLE shift_swap_requests IS 'Employee-initiated shift swap requests with approval workflow';
COMMENT ON TABLE shift_coverage_requirements IS 'Minimum/maximum staffing requirements by time period';

COMMENT ON COLUMN planned_shifts.contract_type IS 'Denormalized from employment_contracts - determines pay calculation (CDDTI vs CDI/CDD)';
COMMENT ON COLUMN planned_shifts.estimated_cost IS 'Forecasted cost based on contract type: CDDTI uses hourly calc, CDI/CDD uses monthly';
COMMENT ON COLUMN planned_shifts.has_conflicts IS 'Auto-detected conflicts: overlapping shifts, time off, rest period violations';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify tables created
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('shift_templates', 'planned_shifts', 'shift_swap_requests', 'shift_coverage_requirements')) = 4,
         'Not all shift planning tables were created';

  RAISE NOTICE 'Migration completed successfully - 4 tables created';
END $$;
