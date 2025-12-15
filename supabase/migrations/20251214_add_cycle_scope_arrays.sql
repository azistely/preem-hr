-- Migration: Add multi-select scope fields to performance_cycles
-- Purpose: Support selecting multiple departments or positions for a cycle
--
-- New cycle scope types:
-- - 'company': All employees (existing)
-- - 'departments': Multiple departments (new)
-- - 'positions': Multiple positions (new)
-- - 'department': Single department (legacy, kept for compatibility)
-- - 'individual': Single employee (legacy, kept for compatibility)

-- Add new columns for multi-select scope
ALTER TABLE performance_cycles
ADD COLUMN IF NOT EXISTS target_department_ids jsonb,
ADD COLUMN IF NOT EXISTS target_position_ids jsonb;

-- Add comments
COMMENT ON COLUMN performance_cycles.target_department_ids IS 'Array of department UUIDs for cycle_scope=departments';
COMMENT ON COLUMN performance_cycles.target_position_ids IS 'Array of position UUIDs for cycle_scope=positions';

-- Create indexes for JSONB array queries
CREATE INDEX IF NOT EXISTS idx_performance_cycles_target_department_ids
ON performance_cycles USING GIN (target_department_ids);

CREATE INDEX IF NOT EXISTS idx_performance_cycles_target_position_ids
ON performance_cycles USING GIN (target_position_ids);
