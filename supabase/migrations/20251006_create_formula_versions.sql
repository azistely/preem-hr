-- Migration: Create formula version tracking tables
-- Purpose: Track formula changes over time for audit compliance
-- Date: 2025-10-06

-- ============================================================================
-- Formula Versions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS salary_component_formula_versions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Component reference
  component_id UUID NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('standard', 'custom')),

  -- Version info
  version_number INT NOT NULL,

  -- Formula data (JSONB to support different formula types)
  calculation_rule JSONB NOT NULL,

  -- Effective dates
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL if currently active

  -- Audit trail
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_version UNIQUE (component_id, component_type, version_number),
  CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index for finding active formula at a specific date
CREATE INDEX idx_formula_active_at
ON salary_component_formula_versions(component_id, component_type, effective_from, effective_to);

-- Index for component history queries
CREATE INDEX idx_formula_component_history
ON salary_component_formula_versions(component_id, component_type, version_number DESC);

-- Index for audit queries (who changed what when)
CREATE INDEX idx_formula_audit
ON salary_component_formula_versions(changed_by, created_at DESC);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE salary_component_formula_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can view their own component versions
CREATE POLICY "Tenants can view their component formula versions"
ON salary_component_formula_versions
FOR SELECT
USING (
  -- For custom components: check tenant ownership
  (component_type = 'custom' AND component_id IN (
    SELECT id FROM custom_salary_components
    WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
  ))
  OR
  -- For standard components: all tenants can view (public)
  component_type = 'standard'
);

-- Policy: Only authenticated users can insert versions
-- (Actual inserts happen via tRPC with proper validation)
CREATE POLICY "Authenticated users can create formula versions"
ON salary_component_formula_versions
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- Helper Function: Get Active Formula Version
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_formula_version(
  p_component_id UUID,
  p_component_type TEXT,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_formula JSONB;
BEGIN
  SELECT calculation_rule INTO v_formula
  FROM salary_component_formula_versions
  WHERE component_id = p_component_id
    AND component_type = p_component_type
    AND effective_from <= p_as_of_date
    AND (effective_to IS NULL OR effective_to >= p_as_of_date)
  ORDER BY version_number DESC
  LIMIT 1;

  RETURN v_formula;
END;
$$;

-- ============================================================================
-- Helper Function: Create New Formula Version
-- ============================================================================

CREATE OR REPLACE FUNCTION create_formula_version(
  p_component_id UUID,
  p_component_type TEXT,
  p_calculation_rule JSONB,
  p_changed_by UUID,
  p_change_reason TEXT DEFAULT NULL,
  p_effective_from DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_version INT;
  v_new_version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM salary_component_formula_versions
  WHERE component_id = p_component_id
    AND component_type = p_component_type;

  -- Close previous active version (if any)
  UPDATE salary_component_formula_versions
  SET effective_to = p_effective_from - INTERVAL '1 day'
  WHERE component_id = p_component_id
    AND component_type = p_component_type
    AND effective_to IS NULL
    AND effective_from < p_effective_from;

  -- Insert new version
  INSERT INTO salary_component_formula_versions (
    component_id,
    component_type,
    version_number,
    calculation_rule,
    effective_from,
    changed_by,
    change_reason
  )
  VALUES (
    p_component_id,
    p_component_type,
    v_next_version,
    p_calculation_rule,
    p_effective_from,
    p_changed_by,
    p_change_reason
  )
  RETURNING id INTO v_new_version_id;

  RETURN v_new_version_id;
END;
$$;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE salary_component_formula_versions IS
'Tracks formula changes over time for salary components. Supports audit compliance and historical payroll accuracy.';

COMMENT ON COLUMN salary_component_formula_versions.component_id IS
'References either custom_salary_components.id or salary_component_definitions.id depending on component_type';

COMMENT ON COLUMN salary_component_formula_versions.component_type IS
'Type of component: standard (super admin seeded) or custom (tenant-specific)';

COMMENT ON COLUMN salary_component_formula_versions.version_number IS
'Sequential version number starting from 1 for each component';

COMMENT ON COLUMN salary_component_formula_versions.calculation_rule IS
'Formula metadata: { type: "fixed" | "percentage" | "auto-calculated", rate?, cap?, baseAmount? }';

COMMENT ON COLUMN salary_component_formula_versions.effective_from IS
'Date from which this formula version is active';

COMMENT ON COLUMN salary_component_formula_versions.effective_to IS
'Date until which this formula version was active (NULL if currently active)';

COMMENT ON FUNCTION get_active_formula_version IS
'Returns the active formula for a component at a specific date. Used for historical payroll calculations.';

COMMENT ON FUNCTION create_formula_version IS
'Creates a new formula version and closes the previous one. Returns the new version ID.';
