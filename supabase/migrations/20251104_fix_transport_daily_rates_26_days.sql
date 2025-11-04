-- Fix transport daily rates: Change from ÷30 to ÷26
--
-- Issue: Transport daily rates were incorrectly calculated as monthly_minimum ÷ 30
-- Correct: Should be monthly_minimum ÷ 26 (standard working days per month)
--
-- Legal basis (Côte d'Ivoire):
-- SALAIRE TYPE JOURNALIER NOUVEAU 2023
-- "PRIME DE TRANSPORT PAR JOUR : 30 000 / 26 = 1154 F/Jour"
--
-- Rationale:
-- - 30 days per month - 4 Sundays = 26 working days
-- - This is the standard calculation for daily rates in Côte d'Ivoire

-- Update existing Côte d'Ivoire transport rates
UPDATE city_transport_minimums
SET
  daily_rate = ROUND(monthly_minimum / 26, 2),
  updated_at = NOW()
WHERE country_code = 'CI';

-- Update comment to reflect correct calculation
COMMENT ON COLUMN city_transport_minimums.daily_rate IS
'Daily transport rate calculated as monthly_minimum ÷ 26 working days (30 days - 4 Sundays).
CI example: Abidjan 30,000 ÷ 26 = 1,154 FCFA/day (not ÷30)';

-- Verify the changes
DO $$
DECLARE
  v_record RECORD;
BEGIN
  RAISE NOTICE 'Updated transport daily rates (÷26):';
  FOR v_record IN
    SELECT
      city_name,
      monthly_minimum,
      daily_rate,
      ROUND(monthly_minimum / 26, 2) as calculated_rate
    FROM city_transport_minimums
    WHERE country_code = 'CI'
    ORDER BY city_name
  LOOP
    RAISE NOTICE '  % - %: % FCFA/month → % FCFA/day (calculated: %)',
      v_record.city_name,
      'CI',
      v_record.monthly_minimum,
      v_record.daily_rate,
      v_record.calculated_rate;
  END LOOP;
END $$;
