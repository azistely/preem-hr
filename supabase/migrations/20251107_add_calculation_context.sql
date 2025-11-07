-- Migration: Add calculation_context to payroll_line_items for full auditability
-- Date: 2025-11-07
-- Purpose: Store all input parameters used for payroll calculation to enable
--          exact reproduction of calculations and historical auditing

-- Add calculation_context JSONB field to store all calculation inputs
ALTER TABLE payroll_line_items
ADD COLUMN IF NOT EXISTS calculation_context JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN payroll_line_items.calculation_context IS
'Stores all input parameters used for payroll calculation including:
- employeeContext: fiscalParts, maritalStatus, dependentChildren, hasFamily
- employmentContext: rateType, contractType, weeklyHoursRegime, paymentFrequency, sectorCode
- salaryContext: salaireCategoriel, sursalaire, components snapshot
- timeContext: hireDate, terminationDate, periodStart, periodEnd
- calculationMeta: version, engine, countryCode, calculatedAt';

-- Example structure:
-- {
--   "employeeContext": {
--     "fiscalParts": 2.5,
--     "maritalStatus": "married",
--     "dependentChildren": 2,
--     "hasFamily": true
--   },
--   "employmentContext": {
--     "rateType": "MONTHLY",
--     "contractType": "CDI",
--     "weeklyHoursRegime": "40h",
--     "paymentFrequency": "MONTHLY",
--     "sectorCode": "SERVICES"
--   },
--   "salaryContext": {
--     "salaireCategoriel": 150000,
--     "sursalaire": 0,
--     "components": [...]
--   },
--   "timeContext": {
--     "hireDate": "2024-01-15",
--     "terminationDate": null,
--     "periodStart": "2025-01-01",
--     "periodEnd": "2025-01-31"
--   },
--   "calculationMeta": {
--     "version": "v2",
--     "engine": "calculatePayrollV2",
--     "countryCode": "CI",
--     "calculatedAt": "2025-01-31T10:30:00Z"
--   }
-- }
