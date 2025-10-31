-- Remove position_id column from employees table
-- This column was incorrectly added - the system uses the assignments junction table instead

-- Drop the index first
DROP INDEX IF EXISTS idx_employees_position_id;

-- Drop the column
ALTER TABLE employees
DROP COLUMN IF EXISTS position_id;

-- Add comment explaining the architecture
COMMENT ON TABLE assignments IS 'Junction table linking employees to positions. Supports historical tracking of position changes over time. Use this table instead of a direct foreign key on employees table.';
