-- Migration: Add gender eligibility to time-off policies
-- Date: 2025-11-11
-- Description: Add eligible_gender column to filter policies by employee gender
--              This ensures employees only get appropriate leave types
--              (e.g., only women get maternity leave, only men get paternity leave)

-- Step 1: Add eligible_gender column
ALTER TABLE time_off_policies
ADD COLUMN IF NOT EXISTS eligible_gender TEXT;

-- Step 2: Add comment
COMMENT ON COLUMN time_off_policies.eligible_gender IS
  'Gender eligibility for this policy: male, female, or NULL (all genders eligible)';

-- Step 3: Add check constraint to ensure valid values
ALTER TABLE time_off_policies
ADD CONSTRAINT time_off_policies_eligible_gender_check
CHECK (eligible_gender IS NULL OR eligible_gender IN ('male', 'female', 'all'));

-- Step 4: Update existing policies with appropriate gender eligibility
-- Maternity leave -> female only
UPDATE time_off_policies
SET eligible_gender = 'female'
WHERE policy_type = 'maternity'
  AND eligible_gender IS NULL;

-- Paternity/birth leave -> male only
UPDATE time_off_policies
SET eligible_gender = 'male'
WHERE policy_type IN ('paternity', 'birth')
  AND eligible_gender IS NULL;

-- Menstrual leave -> female only (if exists)
UPDATE time_off_policies
SET eligible_gender = 'female'
WHERE policy_type = 'menstrual'
  AND eligible_gender IS NULL;

-- All other leave types -> available to all genders (NULL = all)
-- No update needed as NULL is the default

-- Step 5: Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_time_off_policies_eligible_gender
ON time_off_policies(eligible_gender);

-- Step 6: Clean up incorrectly assigned balances
-- Delete maternity leave balances for male employees
DELETE FROM time_off_balances
WHERE policy_id IN (
  SELECT id FROM time_off_policies WHERE policy_type = 'maternity'
)
AND employee_id IN (
  SELECT id FROM employees WHERE gender = 'male'
);

-- Delete paternity leave balances for female employees
DELETE FROM time_off_balances
WHERE policy_id IN (
  SELECT id FROM time_off_policies WHERE policy_type IN ('paternity', 'birth')
)
AND employee_id IN (
  SELECT id FROM employees WHERE gender = 'female'
);

-- Delete menstrual leave balances for male employees
DELETE FROM time_off_balances
WHERE policy_id IN (
  SELECT id FROM time_off_policies WHERE policy_type = 'menstrual'
)
AND employee_id IN (
  SELECT id FROM employees WHERE gender = 'male'
);

-- Note: Employees with gender=NULL will keep all balances
-- They can manually remove inappropriate ones or update their gender
