-- Add date of birth column to employees table
-- Required for CMU beneficiary export and official declarations

ALTER TABLE employees
ADD COLUMN date_of_birth DATE;

-- Create index for reporting queries
CREATE INDEX idx_employees_date_of_birth ON employees(date_of_birth);

-- Add comment for documentation
COMMENT ON COLUMN employees.date_of_birth IS 'Employee date of birth - required for CMU and other official declarations (CNPS, tax forms, etc.)';
