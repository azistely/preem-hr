-- Add Carryover Enforcement (P1 Gap #7)
--
-- Purpose:
-- Enforce 6-month carryover limit per Convention Collective Article 28
-- Unused leave expires 6 months after period end
--
-- Convention Collective Article 28:
-- "Les congés non pris doivent être pris dans les 6 mois suivant
-- la période de référence, sinon ils sont perdus."

BEGIN;

-- Add expires_at column to time_off_balances
ALTER TABLE time_off_balances
  ADD COLUMN IF NOT EXISTS expires_at DATE;

-- Add metadata column for tracking expired balances
ALTER TABLE time_off_balances
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing balances to set expiration date (6 months after period_end)
UPDATE time_off_balances
SET expires_at = (period_end + INTERVAL '6 months')::date
WHERE expires_at IS NULL;

-- Add index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_time_off_balances_expires_at
  ON time_off_balances(expires_at)
  WHERE expires_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN time_off_balances.expires_at IS
  'Date when unused balance expires (6 months after period_end per Article 28)';

COMMENT ON COLUMN time_off_balances.metadata IS
  'JSONB metadata including expired amounts and carryover history';

-- Create helper function to expire old balances
CREATE OR REPLACE FUNCTION expire_old_leave_balances()
RETURNS TABLE(
  employee_id UUID,
  policy_id UUID,
  expired_amount NUMERIC,
  new_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  balance_record RECORD;
  expired_days NUMERIC;
BEGIN
  -- Find all balances with expired dates in the past
  FOR balance_record IN
    SELECT *
    FROM time_off_balances
    WHERE expires_at < CURRENT_DATE
      AND balance > 0
  LOOP
    -- Calculate expired amount (all remaining balance expires)
    expired_days := balance_record.balance;

    -- Update balance and track expiration in metadata
    UPDATE time_off_balances
    SET
      balance = 0,
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{expired_history}',
        COALESCE(metadata->'expired_history', '[]'::jsonb) ||
        jsonb_build_object(
          'amount', expired_days,
          'expired_on', CURRENT_DATE,
          'reason', 'Carryover limit exceeded (6 months)'
        )
      ),
      updated_at = NOW()
    WHERE id = balance_record.id;

    -- Return expired balance info
    RETURN QUERY SELECT
      balance_record.employee_id,
      balance_record.policy_id,
      expired_days,
      0::NUMERIC; -- new balance is always 0 after expiration
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION expire_old_leave_balances() IS
  'Expires balances past their 6-month carryover limit (Article 28)';

-- Create warning function to notify employees 30 days before expiration
CREATE OR REPLACE FUNCTION get_expiring_balances(days_threshold INT DEFAULT 30)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  policy_name TEXT,
  balance NUMERIC,
  expires_at DATE,
  days_until_expiry INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tob.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    top.name AS policy_name,
    tob.balance,
    tob.expires_at,
    (tob.expires_at - CURRENT_DATE)::INT AS days_until_expiry
  FROM time_off_balances tob
  JOIN employees e ON e.id = tob.employee_id
  JOIN time_off_policies top ON top.id = tob.policy_id
  WHERE tob.expires_at IS NOT NULL
    AND tob.expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + days_threshold
    AND tob.balance > 0
  ORDER BY tob.expires_at ASC;
END;
$$;

COMMENT ON FUNCTION get_expiring_balances(INT) IS
  'Get balances expiring within X days (default 30) for proactive warnings';

COMMIT;

-- Usage Examples:
--
-- 1. Manually expire old balances (admin):
--    SELECT * FROM expire_old_leave_balances();
--
-- 2. Get balances expiring in next 30 days (for alerts):
--    SELECT * FROM get_expiring_balances(30);
--
-- 3. Get balances expiring in next 7 days (urgent):
--    SELECT * FROM get_expiring_balances(7);
--
-- 4. View expired balance history:
--    SELECT
--      employee_id,
--      balance,
--      metadata->'expired_history' AS expired_history
--    FROM time_off_balances
--    WHERE metadata ? 'expired_history';
