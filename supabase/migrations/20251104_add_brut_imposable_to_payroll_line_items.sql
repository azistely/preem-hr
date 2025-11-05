-- Migration: Add brut_imposable column to payroll_line_items
-- Date: 2025-11-04
-- Purpose: Track taxable gross (brut imposable) for cumulative AT/PF ceiling enforcement
--          Required for CDDTI workers: AT and PF contributions capped at 75,000 FCFA cumulative per month
--
-- Context:
-- - For regular employees: AT/PF base = min(brut_imposable, 75,000) per payroll run
-- - For CDDTI journaliers: AT/PF base = min(brut_imposable, remaining_ceiling_in_month)
--   where remaining_ceiling = max(0, 75,000 - cumulative_brut_imposable_this_month)
--
-- Example (CDDTI with 4 weekly runs):
--   Week 1: brut_imposable=30k, cumulative=0   → base=30k, AT=600, PF=1,725
--   Week 2: brut_imposable=35k, cumulative=30k → base=35k, AT=700, PF=2,013
--   Week 3: brut_imposable=20k, cumulative=65k → base=10k, AT=200, PF=575  (prorated!)
--   Week 4: brut_imposable=15k, cumulative=85k → base=0,   AT=0,   PF=0

-- Add brut_imposable column
ALTER TABLE payroll_line_items
ADD COLUMN IF NOT EXISTS brut_imposable NUMERIC(15, 2);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN payroll_line_items.brut_imposable IS
'Salaire brut imposable (taxable gross salary) - sum of taxable portions of all components. Used for cumulative AT/PF ceiling enforcement for CDDTI workers: contributions capped at 75,000 FCFA cumulative per month. Formula: sum(component.taxablePortion where component.includeInBrutImposable = true)';

-- Create index for efficient cumulative queries (CDDTI multi-run scenarios)
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_employee_period
ON payroll_line_items (employee_id, created_at);

COMMENT ON INDEX idx_payroll_line_items_employee_period IS
'Optimizes cumulative brut_imposable queries for CDDTI workers with multiple payroll runs per month';
