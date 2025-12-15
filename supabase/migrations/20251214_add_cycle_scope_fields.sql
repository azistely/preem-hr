-- Migration: Add cycle scope fields for unified evaluation experience
-- This replaces the ad-hoc evaluation approach with "individual cycles"
-- All evaluations now go through the cycle system, just with different scopes

-- Add cycle scope to performance_cycles
-- 'company' = all employees (default, traditional annual review)
-- 'department' = specific department
-- 'individual' = single employee (replaces ad-hoc evaluations)
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS cycle_scope text NOT NULL DEFAULT 'company';

-- Add target employee for individual cycles
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS target_employee_id uuid REFERENCES employees(id) ON DELETE CASCADE;

-- Add target department for department-scoped cycles
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS target_department_id uuid REFERENCES departments(id) ON DELETE CASCADE;

-- Add reason for individual evaluations (replaces evaluation.ad_hoc_type)
-- Values: 'probation', 'cdd_renewal', 'cddti_check', 'performance_improvement', 'promotion', 'other'
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS individual_reason text;

-- Add notes/context for individual evaluations
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS individual_notes text;

-- Add check constraint for cycle_scope values
ALTER TABLE performance_cycles
DROP CONSTRAINT IF EXISTS performance_cycles_cycle_scope_check;

ALTER TABLE performance_cycles
ADD CONSTRAINT performance_cycles_cycle_scope_check
CHECK (cycle_scope IN ('company', 'department', 'individual'));

-- Add check constraint for individual_reason values
ALTER TABLE performance_cycles
DROP CONSTRAINT IF EXISTS performance_cycles_individual_reason_check;

ALTER TABLE performance_cycles
ADD CONSTRAINT performance_cycles_individual_reason_check
CHECK (individual_reason IS NULL OR individual_reason IN ('probation', 'cdd_renewal', 'cddti_check', 'performance_improvement', 'promotion', 'other'));

-- Add constraint: target_employee_id required when cycle_scope = 'individual'
-- Note: Using a trigger instead of CHECK constraint for better error messages

-- Create index for efficient querying of individual cycles by employee
CREATE INDEX IF NOT EXISTS idx_performance_cycles_target_employee
ON performance_cycles(target_employee_id)
WHERE target_employee_id IS NOT NULL;

-- Create index for efficient querying of department cycles
CREATE INDEX IF NOT EXISTS idx_performance_cycles_target_department
ON performance_cycles(target_department_id)
WHERE target_department_id IS NOT NULL;

-- Create index for efficient querying by cycle scope
CREATE INDEX IF NOT EXISTS idx_performance_cycles_scope
ON performance_cycles(tenant_id, cycle_scope);

-- Comment explaining the unified approach
COMMENT ON COLUMN performance_cycles.cycle_scope IS 'Evaluation scope: company (all employees), department (one dept), or individual (single employee, replaces ad-hoc)';
COMMENT ON COLUMN performance_cycles.target_employee_id IS 'For individual cycles: the specific employee being evaluated';
COMMENT ON COLUMN performance_cycles.target_department_id IS 'For department cycles: the specific department being evaluated';
COMMENT ON COLUMN performance_cycles.individual_reason IS 'For individual cycles: reason for evaluation (probation, cdd_renewal, etc.)';
COMMENT ON COLUMN performance_cycles.individual_notes IS 'For individual cycles: additional context or notes';
