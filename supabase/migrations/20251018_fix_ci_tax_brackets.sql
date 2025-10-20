-- Fix Côte d'Ivoire Tax Brackets
-- Changes rates and thresholds from annual to monthly (as per payroll-joel-ci-hr-.md)

-- First, find the tax system ID for CI
DO $$
DECLARE
  v_tax_system_id uuid;
BEGIN
  -- Get CI tax system ID
  SELECT id INTO v_tax_system_id
  FROM tax_systems
  WHERE country_code = 'CI'
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
  LIMIT 1;

  IF v_tax_system_id IS NULL THEN
    RAISE EXCEPTION 'No active tax system found for CI';
  END IF;

  -- Delete existing brackets
  DELETE FROM tax_brackets
  WHERE tax_system_id = v_tax_system_id;

  -- Insert corrected brackets (MONTHLY thresholds)
  INSERT INTO tax_brackets (tax_system_id, bracket_order, min_amount, max_amount, rate, description) VALUES
  (v_tax_system_id, 1, 0, 75000, 0.0000, '{"fr": "Jusqu''à 75 000 FCFA", "en": "Up to 75,000 FCFA"}'),
  (v_tax_system_id, 2, 75000, 240000, 0.1600, '{"fr": "75 001 - 240 000 FCFA", "en": "75,001 - 240,000 FCFA"}'),
  (v_tax_system_id, 3, 240000, 800000, 0.2100, '{"fr": "240 001 - 800 000 FCFA", "en": "240,001 - 800,000 FCFA"}'),
  (v_tax_system_id, 4, 800000, 2400000, 0.2400, '{"fr": "800 001 - 2 400 000 FCFA", "en": "800,001 - 2,400,000 FCFA"}'),
  (v_tax_system_id, 5, 2400000, 8000000, 0.2800, '{"fr": "2 400 001 - 8 000 000 FCFA", "en": "2,400,001 - 8,000,000 FCFA"}'),
  (v_tax_system_id, 6, 8000000, NULL, 0.3200, '{"fr": "Plus de 8 000 000 FCFA", "en": "Over 8,000,000 FCFA"}');

  RAISE NOTICE 'Tax brackets updated successfully for CI';
END $$;
