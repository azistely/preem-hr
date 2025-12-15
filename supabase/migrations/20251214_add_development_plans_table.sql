-- Migration: Add Individual Development Plans (IDP) Table
-- Date: 2025-12-14
-- Description: Adds development_plans table for tracking employee IDPs
--
-- Context:
-- - IDPs can be created from evaluation competency gaps
-- - Includes goals, training recommendations, and progress tracking
-- - Links to performance evaluations and training enrollments

-- Create development_plans table
CREATE TABLE IF NOT EXISTS development_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Source evaluation (optional - can be created independently)
  evaluation_id UUID REFERENCES evaluations(id) ON DELETE SET NULL,
  cycle_id UUID REFERENCES performance_cycles(id) ON DELETE SET NULL,

  -- Plan details
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',

  -- Goals/actions (JSON array)
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Training recommendations (JSON array)
  recommended_trainings JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Manager and employee notes
  manager_notes TEXT,
  employee_notes TEXT,

  -- Competency gaps snapshot
  competency_gaps JSONB,

  -- Key metrics
  total_goals INTEGER DEFAULT 0,
  completed_goals INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,

  -- Dates
  start_date DATE,
  target_end_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Approval workflow
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Add check constraint for valid status values
ALTER TABLE development_plans
ADD CONSTRAINT chk_development_plan_status
CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'archived'));

-- Add check constraint for progress percentage
ALTER TABLE development_plans
ADD CONSTRAINT chk_progress_percentage
CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_development_plans_tenant_id
ON development_plans(tenant_id);

CREATE INDEX IF NOT EXISTS idx_development_plans_employee_id
ON development_plans(employee_id);

CREATE INDEX IF NOT EXISTS idx_development_plans_evaluation_id
ON development_plans(evaluation_id)
WHERE evaluation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_development_plans_status
ON development_plans(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_development_plans_cycle_id
ON development_plans(cycle_id)
WHERE cycle_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE development_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation
CREATE POLICY tenant_isolation ON development_plans
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
COMMENT ON TABLE development_plans IS 'Individual Development Plans (IDP) tracking employee growth and competency development';
COMMENT ON COLUMN development_plans.goals IS 'JSON array of development goals with status tracking';
COMMENT ON COLUMN development_plans.recommended_trainings IS 'JSON array of training recommendations from competency gap analysis';
COMMENT ON COLUMN development_plans.competency_gaps IS 'Snapshot of competency gaps at plan creation time';
COMMENT ON COLUMN development_plans.progress_percentage IS 'Overall plan completion percentage (0-100)';
