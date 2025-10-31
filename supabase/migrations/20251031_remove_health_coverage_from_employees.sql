-- Remove health_coverage column from employees table
-- Health coverage is now properly normalized via employee_benefit_enrollments table

-- Drop the column
ALTER TABLE employees
DROP COLUMN IF EXISTS health_coverage;

-- Add comment explaining the architecture
COMMENT ON TABLE employee_benefit_enrollments IS 'Tracks employee enrollment in benefit plans (health insurance, CMU, etc.). Links employees to benefit_plans with enrollment dates, coverage details, and enrollment numbers (N° CMU for CMU coverage).';
