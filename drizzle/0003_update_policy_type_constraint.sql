-- Migration: Update policy_type CHECK constraint to include new leave types
-- Date: 2025-11-16
-- Purpose: Allow all new unpaid leave types (permission, unpaid_leave, strike, etc.)

-- Drop old constraint
ALTER TABLE time_off_policies
DROP CONSTRAINT IF EXISTS valid_policy_type;

-- Add new constraint with all policy types
ALTER TABLE time_off_policies
ADD CONSTRAINT valid_policy_type CHECK (
  policy_type IN (
    -- Paid leave types
    'annual_leave',
    'sick_leave',
    'maternity',
    'paternity',
    'special_marriage',

    -- Unpaid leave types
    'unpaid',
    'permission',
    'unpaid_leave',
    'unjustified_absence',
    'disciplinary_suspension',
    'unpaid_parental',
    'personal_convenience',
    'unpaid_training',
    'strike',
    'sabbatical',
    'exceptional_unpaid'
  )
);
