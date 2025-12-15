-- Migration: Add Factory Observation KPI System
-- Date: 2025-12-14
-- Description: Adds observation_kpi_templates and observation_logs tables for factory KPI tracking
--
-- Context:
-- - Supports daily/weekly/monthly observations by team leads
-- - Flexible KPI data structure for different factory types (textile, agroalimentaire, BTP)
-- - Integrates with performance evaluation system
-- - Supports Excel import for bulk observation entry

-- ============================================================================
-- TABLE 1: observation_kpi_templates
-- Pre-defined KPI sets for different factory types
-- ============================================================================

CREATE TABLE IF NOT EXISTS observation_kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Template identification
  name TEXT NOT NULL,
  description TEXT,

  -- KPI definitions (JSON array)
  -- Each field: { key, label, type, unit?, options?, required, includeInOverall, weight? }
  kpi_fields JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Default and status
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_observation_kpi_templates_tenant_id
ON observation_kpi_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_observation_kpi_templates_active
ON observation_kpi_templates(tenant_id, is_active)
WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE observation_kpi_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation
CREATE POLICY tenant_isolation ON observation_kpi_templates
FOR ALL
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR (auth.jwt() ->> 'role') = 'super_admin'
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- Add comments
COMMENT ON TABLE observation_kpi_templates IS 'Pre-defined KPI templates for factory observation types (e.g., textile, agroalimentaire, BTP)';
COMMENT ON COLUMN observation_kpi_templates.kpi_fields IS 'JSON array of KPI field definitions with key, label, type, unit, required, includeInOverall, weight';

-- ============================================================================
-- TABLE 2: observation_logs
-- Daily/weekly KPI observations by team leads
-- ============================================================================

CREATE TABLE IF NOT EXISTS observation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Who is being observed
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Observer (team lead or HR)
  observer_id UUID REFERENCES employees(id) ON DELETE SET NULL,

  -- When
  observation_date DATE NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly

  -- KPI template used (optional)
  kpi_template_id UUID REFERENCES observation_kpi_templates(id) ON DELETE SET NULL,

  -- KPI Data (flexible JSON)
  kpi_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Overall rating (1-5, computed or manual)
  overall_rating INTEGER,

  -- Comments
  comment TEXT,

  -- Import tracking
  import_batch_id UUID, -- Links to import batch for bulk imports
  import_source TEXT, -- 'excel', 'manual', 'api'

  -- Link to performance cycle (optional)
  cycle_id UUID REFERENCES performance_cycles(id) ON DELETE SET NULL,

  -- Validation workflow
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, validated
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add check constraints
ALTER TABLE observation_logs
ADD CONSTRAINT chk_observation_period
CHECK (period IN ('daily', 'weekly', 'monthly'));

ALTER TABLE observation_logs
ADD CONSTRAINT chk_observation_status
CHECK (status IN ('draft', 'submitted', 'validated'));

ALTER TABLE observation_logs
ADD CONSTRAINT chk_observation_overall_rating
CHECK (overall_rating IS NULL OR (overall_rating >= 1 AND overall_rating <= 5));

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_observation_logs_tenant_id
ON observation_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_observation_logs_employee_id
ON observation_logs(employee_id);

CREATE INDEX IF NOT EXISTS idx_observation_logs_observer_id
ON observation_logs(observer_id)
WHERE observer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_observation_logs_date
ON observation_logs(tenant_id, observation_date DESC);

CREATE INDEX IF NOT EXISTS idx_observation_logs_status
ON observation_logs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_observation_logs_cycle_id
ON observation_logs(cycle_id)
WHERE cycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_observation_logs_import_batch
ON observation_logs(import_batch_id)
WHERE import_batch_id IS NOT NULL;

-- Composite index for common queries (employee + date range)
CREATE INDEX IF NOT EXISTS idx_observation_logs_employee_date
ON observation_logs(tenant_id, employee_id, observation_date DESC);

-- Enable Row Level Security
ALTER TABLE observation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation
CREATE POLICY tenant_isolation ON observation_logs
FOR ALL
TO authenticated
USING (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  OR (auth.jwt() ->> 'role') = 'super_admin'
)
WITH CHECK (
  tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
);

-- Add comments
COMMENT ON TABLE observation_logs IS 'Daily/weekly factory KPI observations by team leads for performance tracking';
COMMENT ON COLUMN observation_logs.kpi_data IS 'Flexible JSON structure for production, attendance, safety, and behavior KPIs';
COMMENT ON COLUMN observation_logs.import_batch_id IS 'Links to import batch for Excel bulk imports';
COMMENT ON COLUMN observation_logs.period IS 'Observation period: daily, weekly, or monthly';

-- ============================================================================
-- DEFAULT KPI TEMPLATE (French labels)
-- ============================================================================

-- Insert default factory KPI template for each tenant (optional - can be done via app)
-- This is commented out as it should be created per-tenant via the application
/*
INSERT INTO observation_kpi_templates (tenant_id, name, description, kpi_fields, is_default, is_active)
SELECT
  t.id,
  'Template Standard Usine',
  'KPIs standards pour observations journalieres en usine',
  '[
    {"key": "unitsProduced", "label": "Unites produites", "type": "number", "required": false, "includeInOverall": true, "weight": 0.2},
    {"key": "defects", "label": "Defauts", "type": "number", "required": false, "includeInOverall": true, "weight": 0.15},
    {"key": "hoursWorked", "label": "Heures travaillees", "type": "number", "unit": "h", "required": false, "includeInOverall": false},
    {"key": "lateMinutes", "label": "Retard (min)", "type": "number", "unit": "min", "required": false, "includeInOverall": false},
    {"key": "safetyScore", "label": "Securite", "type": "rating", "required": false, "includeInOverall": true, "weight": 0.2},
    {"key": "qualityScore", "label": "Qualite", "type": "rating", "required": false, "includeInOverall": true, "weight": 0.25},
    {"key": "teamworkScore", "label": "Travail d equipe", "type": "rating", "required": false, "includeInOverall": true, "weight": 0.2}
  ]'::jsonb,
  true,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM observation_kpi_templates okt
  WHERE okt.tenant_id = t.id AND okt.is_default = true
);
*/
