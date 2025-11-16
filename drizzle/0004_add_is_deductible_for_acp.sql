-- Migration: Add is_deductible_for_acp column to time_off_requests
-- Date: 2025-11-15
-- Purpose: Track whether leave should reduce ACP "jours payés" calculation
--
-- Context:
-- - Paid leave (congés annuels, maladie) = deductible = true (default)
-- - Unpaid leave (permission, congé sans solde, grève) = NOT deductible = false
-- - Non-deductible absences REDUCE the total paid days in ACP calculation

-- Add column with default TRUE (most leave is deductible)
ALTER TABLE time_off_requests
ADD COLUMN is_deductible_for_acp BOOLEAN DEFAULT TRUE NOT NULL;

-- Create index for ACP queries (filtering by deductibility)
CREATE INDEX idx_timeoff_requests_acp_deductible
ON time_off_requests (employee_id, is_deductible_for_acp, start_date, end_date)
WHERE is_deductible_for_acp = FALSE;

-- Update existing unpaid leave requests to be DEDUCTIBLE
-- These absences SHOULD reduce the total paid days (employee was not paid)
UPDATE time_off_requests tor
SET is_deductible_for_acp = TRUE
FROM time_off_policies top
WHERE tor.policy_id = top.id
AND top.policy_type IN (
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
);

-- Update existing PAID leave requests to be NON-DEDUCTIBLE
-- These absences should NOT reduce the total paid days (employee WAS paid)
UPDATE time_off_requests tor
SET is_deductible_for_acp = FALSE
FROM time_off_policies top
WHERE tor.policy_id = top.id
AND top.policy_type IN (
  'annual_leave',
  'sick_leave',
  'maternity',
  'paternity',
  'special_marriage'
);

-- Verify update
-- Expected:
--   - Unpaid leave requests: is_deductible_for_acp = TRUE (reduce paid days)
--   - Paid leave requests: is_deductible_for_acp = FALSE (don't reduce paid days)
SELECT
  top.policy_type,
  top.name,
  top.is_paid,
  tor.is_deductible_for_acp,
  COUNT(*) as request_count
FROM time_off_requests tor
JOIN time_off_policies top ON tor.policy_id = top.id
GROUP BY top.policy_type, top.name, top.is_paid, tor.is_deductible_for_acp
ORDER BY top.is_paid DESC, top.policy_type, tor.is_deductible_for_acp;
