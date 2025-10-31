-- Add position_id column to employees table for position normalization
-- This enables linking employees to positions for org charts, salary bands, etc.

ALTER TABLE employees
ADD COLUMN position_id UUID REFERENCES positions(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_employees_position_id ON employees(position_id);

-- Add comment
COMMENT ON COLUMN employees.position_id IS 'Links employee to their position in the positions table';
