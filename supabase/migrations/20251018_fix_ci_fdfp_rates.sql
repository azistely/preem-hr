-- Fix FDFP (Formation Professionnelle Continue) rate from 1.2% to 0.6%
-- Total FDFP should be 1.0% (0.4% TA + 0.6% FPC), not 1.6%

UPDATE other_taxes
SET
  tax_rate = 0.0060,
  updated_at = NOW()
WHERE country_code = 'CI'
  AND code = 'fdfp_tfpc';

-- Verify the change
SELECT
  code,
  name->>'fr' as name_fr,
  tax_rate,
  calculation_base,
  paid_by
FROM other_taxes
WHERE country_code = 'CI'
  AND code LIKE 'fdfp%'
ORDER BY code;
