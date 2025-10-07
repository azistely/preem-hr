-- Fix P0 Gap #1: Complete Overtime Rules for Convention Collective Compliance
--
-- Changes:
-- 1. Fix public_holiday rate: 1.75x → 2.00x (Article 23)
-- 2. Add 'saturday' and 'sunday' to valid rule types
-- 3. Split weekend into Saturday (1.50x) and Sunday (1.75x)
-- 4. Update display names for clarity
--
-- Convention Collective Article 23 Requirements:
-- - Hours 41-46: +15% (1.15x) ✅ Already correct
-- - Hours 46+: +50% (1.50x) ✅ Already correct
-- - Saturday: +50% (1.50x) ❌ NEEDS ADD
-- - Sunday: +75% (1.75x) ❌ NEEDS SEPARATION
-- - Public holidays: +100% (2.00x) ❌ NEEDS FIX
-- - Night work (21h-6h): +75% (1.75x) ✅ Already correct

BEGIN;

-- Step 1: Drop the existing constraint
ALTER TABLE overtime_rules DROP CONSTRAINT IF EXISTS valid_rule_type;

-- Step 2: Add updated constraint with saturday and sunday
ALTER TABLE overtime_rules ADD CONSTRAINT valid_rule_type
  CHECK (rule_type IN (
    'hours_41_to_46',
    'hours_above_46',
    'night_work',
    'weekend',
    'saturday',
    'sunday',
    'holiday',
    'public_holiday'
  ));

-- Step 3: Update public_holiday rate from 1.75x to 2.00x
UPDATE overtime_rules
SET
  multiplier = 2.00,
  display_name = jsonb_build_object(
    'fr', 'Jours fériés (+100%)',
    'en', 'Public holidays (+100%)'
  ),
  updated_at = NOW()
WHERE country_code = 'CI'
  AND rule_type = 'public_holiday';

-- Step 4: Update existing weekend rule to be Sunday-only (1.75x)
UPDATE overtime_rules
SET
  rule_type = 'sunday',
  display_name = jsonb_build_object(
    'fr', 'Dimanche (+75%)',
    'en', 'Sunday (+75%)'
  ),
  applies_to_days = jsonb_build_array('sunday'),
  updated_at = NOW()
WHERE country_code = 'CI'
  AND rule_type = 'weekend';

-- Step 5: Add Saturday rule (1.50x) - separate from Sunday
INSERT INTO overtime_rules (
  country_code,
  rule_type,
  display_name,
  description,
  multiplier,
  max_hours_per_week,
  applies_to_days,
  effective_from,
  effective_to
)
VALUES (
  'CI',
  'saturday',
  jsonb_build_object(
    'fr', 'Samedi (+50%)',
    'en', 'Saturday (+50%)'
  ),
  jsonb_build_object(
    'fr', 'Travail le samedi majoré à 150% du taux horaire normal',
    'en', 'Saturday work paid at 150% of normal hourly rate'
  ),
  1.50,
  NULL, -- No specific weekly limit for Saturday alone
  jsonb_build_array('saturday'),
  '2024-01-01',
  NULL
)
ON CONFLICT DO NOTHING;

-- Step 6: Update display names for clarity (add percentage indicators)
UPDATE overtime_rules
SET
  display_name = jsonb_build_object(
    'fr', 'Heures 41 à 46 (+15%)',
    'en', 'Hours 41-46 (+15%)'
  ),
  description = jsonb_build_object(
    'fr', 'Heures supplémentaires 41-46 majorées à 115% du taux horaire',
    'en', 'Overtime hours 41-46 paid at 115% of hourly rate'
  ),
  updated_at = NOW()
WHERE country_code = 'CI'
  AND rule_type = 'hours_41_to_46';

UPDATE overtime_rules
SET
  display_name = jsonb_build_object(
    'fr', 'Heures au-delà de 46 (+50%)',
    'en', 'Hours above 46 (+50%)'
  ),
  description = jsonb_build_object(
    'fr', 'Heures supplémentaires au-delà de 46h majorées à 150%',
    'en', 'Overtime hours above 46 paid at 150% of hourly rate'
  ),
  updated_at = NOW()
WHERE country_code = 'CI'
  AND rule_type = 'hours_above_46';

UPDATE overtime_rules
SET
  display_name = jsonb_build_object(
    'fr', 'Travail de nuit (+75%)',
    'en', 'Night work (+75%)'
  ),
  description = jsonb_build_object(
    'fr', 'Travail entre 21h et 6h majoré à 175% du taux horaire',
    'en', 'Work between 9PM and 6AM paid at 175% of hourly rate'
  ),
  updated_at = NOW()
WHERE country_code = 'CI'
  AND rule_type = 'night_work';

COMMIT;

-- Verification query
SELECT
  rule_type,
  (display_name->>'fr') as nom_francais,
  multiplier as taux,
  applies_to_days as jours,
  applies_from_time as heure_debut,
  applies_to_time as heure_fin
FROM overtime_rules
WHERE country_code = 'CI'
ORDER BY
  CASE rule_type
    WHEN 'hours_41_to_46' THEN 1
    WHEN 'hours_above_46' THEN 2
    WHEN 'saturday' THEN 3
    WHEN 'sunday' THEN 4
    WHEN 'public_holiday' THEN 5
    WHEN 'night_work' THEN 6
  END;
