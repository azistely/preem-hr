-- Migration: Add Payment Frequency to Payroll Runs (Phase 5)
-- Version: 3.0 from DAILY-WORKERS-ARCHITECTURE-V2.md Section 10.5
-- Date: 2025-10-31
-- Purpose: Enable separate pay registers by payment frequency

-- ================================================================
-- PAYROLL_RUNS TABLE EXTENSIONS
-- ================================================================

-- Add payment frequency field (determines register separation)
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE payroll_runs
  ADD CONSTRAINT IF NOT EXISTS valid_payment_frequency_payroll
  CHECK (payment_frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'));

COMMENT ON COLUMN payroll_runs.payment_frequency IS
  'Payment frequency of this payroll run:
  - MONTHLY: 1 closure/month (standard workers)
  - WEEKLY: 4 closures/month (weekly workers, requires closure_sequence 1-4)
  - BIWEEKLY: 2 closures/month (biweekly workers, requires closure_sequence 1-2)
  - DAILY: Rare, daily payments
  Used to generate separate pay registers per frequency.';

-- Add closure sequence field (which week/quinzaine within month)
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS closure_sequence INTEGER;

COMMENT ON COLUMN payroll_runs.closure_sequence IS
  'Closure sequence number within the month:
  - NULL for MONTHLY runs (only 1 closure)
  - 1-4 for WEEKLY runs (Semaine 1, 2, 3, 4)
  - 1-2 for BIWEEKLY runs (Quinzaine 1, 2)
  Used to generate separate pay registers:
  - "Livre de Paie - Hebdomadaire Semaine 1"
  - "Livre de Paie - Quinzaine 2"';

-- Add validation constraint: closure_sequence required for non-monthly
ALTER TABLE payroll_runs
  ADD CONSTRAINT IF NOT EXISTS closure_sequence_required
  CHECK (
    payment_frequency = 'MONTHLY' OR
    (payment_frequency IN ('WEEKLY', 'BIWEEKLY', 'DAILY') AND closure_sequence IS NOT NULL)
  );

-- Add validation constraint: closure_sequence range by frequency
ALTER TABLE payroll_runs
  ADD CONSTRAINT IF NOT EXISTS valid_closure_sequence
  CHECK (
    (payment_frequency = 'MONTHLY' AND closure_sequence IS NULL) OR
    (payment_frequency = 'WEEKLY' AND closure_sequence BETWEEN 1 AND 4) OR
    (payment_frequency = 'BIWEEKLY' AND closure_sequence BETWEEN 1 AND 2) OR
    (payment_frequency = 'DAILY' AND closure_sequence >= 1)
  );

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Index for filtering payroll runs by payment frequency
CREATE INDEX IF NOT EXISTS idx_payroll_runs_payment_frequency
  ON payroll_runs(tenant_id, payment_frequency, period_start);

-- Composite index for pay register generation (filter by frequency + sequence + period)
CREATE INDEX IF NOT EXISTS idx_payroll_runs_register_generation
  ON payroll_runs(tenant_id, payment_frequency, closure_sequence, period_start, period_end);

-- ================================================================
-- DATA MIGRATION (existing payroll runs)
-- ================================================================

-- All existing payroll runs default to MONTHLY (already set by DEFAULT)
-- No closure_sequence needed for monthly runs (already NULL by default)

-- ================================================================
-- VERIFICATION QUERIES (for testing)
-- ================================================================

-- Verify all payroll runs have valid payment frequency
DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM payroll_runs
  WHERE payment_frequency NOT IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % payroll runs with invalid payment_frequency', v_invalid_count;
  ELSE
    RAISE NOTICE 'All payroll runs have valid payment_frequency ✓';
  END IF;
END
$$;

-- Verify closure_sequence is set correctly for non-monthly runs
DO $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_count
  FROM payroll_runs
  WHERE payment_frequency != 'MONTHLY'
    AND closure_sequence IS NULL;

  IF v_missing_count > 0 THEN
    RAISE WARNING 'Found % non-monthly payroll runs missing closure_sequence', v_missing_count;
  ELSE
    RAISE NOTICE 'All non-monthly payroll runs have valid closure_sequence ✓';
  END IF;
END
$$;
