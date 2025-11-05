-- Migration: Add contribution_details column to payroll_line_items
-- Date: 2025-11-04
-- Purpose: Store detailed breakdown of CNPS contributions (Pension, AT, PF) for UI display
--
-- Context:
-- - contributionDetails array from payroll-calculation-v2.ts contains individual contributions
-- - Each contribution has: code, name, amount, paidBy (employee/employer), rate, base
-- - Required for displaying "CNPS Employeur" breakdown: Pension + AT + PF
--
-- Example data:
-- [
--   {"code": "pension", "name": "Retraite", "amount": 574, "paidBy": "employer", "rate": 0.077, "base": 7450},
--   {"code": "work_accident", "name": "Accident du Travail", "amount": 149, "paidBy": "employer", "rate": 0.02, "base": 7450},
--   {"code": "family_benefits", "name": "Prestations Familiales", "amount": 428, "paidBy": "employer", "rate": 0.0575, "base": 7450}
-- ]

-- Add contribution_details column
ALTER TABLE payroll_line_items
ADD COLUMN IF NOT EXISTS contribution_details JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN payroll_line_items.contribution_details IS
'Detailed breakdown of all social security contributions (CNPS, CMU, etc.) with individual amounts for Pension, AT, PF, etc. Array of objects with: code, name, amount, paidBy (employee/employer), rate, base. Used for detailed UI display of employer charges breakdown.';

-- Create index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_payroll_line_items_contribution_details
ON payroll_line_items USING gin (contribution_details);

COMMENT ON INDEX idx_payroll_line_items_contribution_details IS
'GIN index for efficient JSONB queries on contribution_details (e.g., filtering by contribution code or paidBy)';
