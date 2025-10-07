-- Policy Configuration Tables: Overtime Rates & Leave Accrual Rules
-- Following Convention Collective compliance with database-driven multi-country support
--
-- Purpose: Store legal overtime rates and leave accrual rules per country
-- These tables replace hardcoded logic and enable multi-country expansion via database seeds

BEGIN;

-- ============================================================================
-- TABLE: overtime_rates
-- ============================================================================
-- Purpose: Multi-country overtime multiplier rates (Convention Collective compliant)
-- Replaces: Hardcoded overtime logic in calculation engine
--
-- Convention Collective (Côte d'Ivoire) Article 23:
-- - Hours 41-48: +15% (1.15x)
-- - Hours 48+: +50% (1.50x)
-- - Saturday: +50% (1.50x)
-- - Sunday: +75% (1.75x)
-- - Public holidays: +100% (2.00x)
-- - Night work (21h-6h): +75% (1.75x)

CREATE TABLE IF NOT EXISTS overtime_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,

  -- Period type (what triggers this rate)
  period_type VARCHAR(30) NOT NULL CHECK (period_type IN (
    'weekday_41_48',    -- Hours 41-48 on weekdays
    'weekday_48_plus',  -- Hours 48+ on weekdays
    'saturday',         -- Saturday work
    'sunday',           -- Sunday work
    'holiday',          -- Public holiday work
    'night'             -- Night work (21h-6h)
  )),

  -- Rates
  rate_multiplier NUMERIC(3,2) NOT NULL CHECK (rate_multiplier >= 1.00 AND rate_multiplier <= 3.00),
  legal_minimum NUMERIC(3,2) NOT NULL CHECK (legal_minimum >= 1.00 AND legal_minimum <= 3.00),

  -- Effective dating (support rate changes over time)
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- Metadata
  display_name JSONB NOT NULL DEFAULT '{"fr": "", "en": ""}'::jsonb,
  description JSONB,
  legal_reference TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint: one rate per country+period at any given time
  CONSTRAINT unique_overtime_rate_per_period
    EXCLUDE USING gist (
      country_code WITH =,
      period_type WITH =,
      daterange(effective_from, effective_to, '[)') WITH &&
    )
);

CREATE INDEX idx_overtime_rates_country ON overtime_rates(country_code);
CREATE INDEX idx_overtime_rates_effective ON overtime_rates(country_code, effective_from, effective_to)
  WHERE effective_to IS NULL; -- Active rates only

COMMENT ON TABLE overtime_rates IS 'Multi-country overtime multiplier rates (Convention Collective compliant)';
COMMENT ON COLUMN overtime_rates.period_type IS 'Trigger for this rate (weekday_41_48, weekday_48_plus, saturday, sunday, holiday, night)';
COMMENT ON COLUMN overtime_rates.legal_minimum IS 'Minimum rate required by law (tenant cannot set rate_multiplier below this)';

-- ============================================================================
-- TABLE: leave_accrual_rules
-- ============================================================================
-- Purpose: Age-based and seniority-based leave accrual rules per country
--
-- Convention Collective (Côte d'Ivoire) Article 28:
-- - Standard: 2.0 days/month (24 days/year)
-- - Under 21: 2.5 days/month (30 days/year)
-- - Seniority bonuses:
--   - 15 years: +2 days/year (26 days total)
--   - 20 years: +4 days/year (28 days total)
--   - 25 years: +6 days/year (30 days total)

CREATE TABLE IF NOT EXISTS leave_accrual_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,

  -- Rule triggers (NULL = applies to all)
  age_threshold INTEGER CHECK (age_threshold IS NULL OR age_threshold > 0),
  seniority_years INTEGER CHECK (seniority_years IS NULL OR seniority_years >= 0),

  -- Accrual amounts
  days_per_month NUMERIC(3,1) NOT NULL CHECK (days_per_month >= 0 AND days_per_month <= 5.0),
  bonus_days INTEGER DEFAULT 0 CHECK (bonus_days >= 0),

  -- Effective dating
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- Metadata
  display_name JSONB DEFAULT '{"fr": "", "en": ""}'::jsonb,
  description JSONB,
  legal_reference TEXT,
  priority INTEGER DEFAULT 0, -- Higher priority = applied first (for overlapping rules)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At least one trigger must be specified
  CONSTRAINT valid_accrual_rule CHECK (
    age_threshold IS NOT NULL OR seniority_years IS NOT NULL
  )
);

CREATE INDEX idx_leave_accrual_country ON leave_accrual_rules(country_code);
CREATE INDEX idx_leave_accrual_age ON leave_accrual_rules(country_code, age_threshold);
CREATE INDEX idx_leave_accrual_seniority ON leave_accrual_rules(country_code, seniority_years);
CREATE INDEX idx_leave_accrual_effective ON leave_accrual_rules(country_code, effective_from, effective_to)
  WHERE effective_to IS NULL;

COMMENT ON TABLE leave_accrual_rules IS 'Age-based and seniority-based leave accrual rules per country';
COMMENT ON COLUMN leave_accrual_rules.age_threshold IS 'NULL = all ages, 21 = under 21 years old';
COMMENT ON COLUMN leave_accrual_rules.seniority_years IS 'NULL = standard rate, 15/20/25 = seniority bonus thresholds';
COMMENT ON COLUMN leave_accrual_rules.days_per_month IS 'Base accrual rate (e.g., 2.0 = 24 days/year)';
COMMENT ON COLUMN leave_accrual_rules.bonus_days IS 'Additional days per year (added to standard accrual)';

-- ============================================================================
-- SEED DATA: Côte d'Ivoire (CI)
-- ============================================================================

-- Overtime Rates (Convention Collective Article 23)
INSERT INTO overtime_rates (
  country_code, period_type, rate_multiplier, legal_minimum,
  effective_from, display_name, description, legal_reference
) VALUES
  -- Weekday overtime
  (
    'CI', 'weekday_41_48', 1.15, 1.15,
    '1977-01-01',
    '{"fr": "Heures 41 à 48 (+15%)", "en": "Hours 41-48 (+15%)"}'::jsonb,
    '{"fr": "Heures supplémentaires 41-48 majorées à 115% du taux horaire", "en": "Overtime hours 41-48 paid at 115% of hourly rate"}'::jsonb,
    'Convention Collective Article 23'
  ),
  (
    'CI', 'weekday_48_plus', 1.50, 1.50,
    '1977-01-01',
    '{"fr": "Heures au-delà de 48 (+50%)", "en": "Hours 48+ (+50%)"}'::jsonb,
    '{"fr": "Heures supplémentaires au-delà de 48h majorées à 150%", "en": "Overtime hours above 48 paid at 150%"}'::jsonb,
    'Convention Collective Article 23'
  ),

  -- Weekend work
  (
    'CI', 'saturday', 1.50, 1.50,
    '1977-01-01',
    '{"fr": "Samedi (+50%)", "en": "Saturday (+50%)"}'::jsonb,
    '{"fr": "Travail le samedi majoré à 150% du taux horaire normal", "en": "Saturday work paid at 150% of normal rate"}'::jsonb,
    'Convention Collective Article 23'
  ),
  (
    'CI', 'sunday', 1.75, 1.75,
    '1977-01-01',
    '{"fr": "Dimanche (+75%)", "en": "Sunday (+75%)"}'::jsonb,
    '{"fr": "Travail le dimanche majoré à 175% du taux horaire normal", "en": "Sunday work paid at 175% of normal rate"}'::jsonb,
    'Convention Collective Article 23'
  ),

  -- Public holidays
  (
    'CI', 'holiday', 2.00, 2.00,
    '1977-01-01',
    '{"fr": "Jours fériés (+100%)", "en": "Public holidays (+100%)"}'::jsonb,
    '{"fr": "Travail les jours fériés majoré à 200% du taux horaire", "en": "Public holiday work paid at 200% of hourly rate"}'::jsonb,
    'Convention Collective Article 23'
  ),

  -- Night work
  (
    'CI', 'night', 1.75, 1.75,
    '1977-01-01',
    '{"fr": "Travail de nuit (+75%)", "en": "Night work (+75%)"}'::jsonb,
    '{"fr": "Travail entre 21h et 6h majoré à 175% du taux horaire", "en": "Work between 9PM and 6AM paid at 175%"}'::jsonb,
    'Convention Collective Article 23'
  )
ON CONFLICT DO NOTHING;

-- Leave Accrual Rules (Convention Collective Article 28)
INSERT INTO leave_accrual_rules (
  country_code, age_threshold, seniority_years, days_per_month, bonus_days,
  effective_from, display_name, description, legal_reference, priority
) VALUES
  -- Standard rate (all employees)
  (
    'CI', NULL, NULL, 2.0, 0,
    '1977-01-01',
    '{"fr": "Taux standard", "en": "Standard rate"}'::jsonb,
    '{"fr": "2 jours par mois travaillé (24 jours par an)", "en": "2 days per month worked (24 days per year)"}'::jsonb,
    'Convention Collective Article 28',
    0
  ),

  -- Under 21 years old (higher rate)
  (
    'CI', 21, NULL, 2.5, 0,
    '1977-01-01',
    '{"fr": "Moins de 21 ans", "en": "Under 21 years"}'::jsonb,
    '{"fr": "2.5 jours par mois pour employés de moins de 21 ans (30 jours par an)", "en": "2.5 days per month for employees under 21 (30 days per year)"}'::jsonb,
    'Convention Collective Article 28',
    10 -- Higher priority than standard
  ),

  -- Seniority bonuses (added to base accrual)
  (
    'CI', NULL, 15, 2.0, 2,
    '1977-01-01',
    '{"fr": "Ancienneté 15 ans (+2 jours)", "en": "15 years seniority (+2 days)"}'::jsonb,
    '{"fr": "Bonus de 2 jours après 15 ans de service (26 jours par an)", "en": "2 days bonus after 15 years of service (26 days per year)"}'::jsonb,
    'Convention Collective Article 28',
    5
  ),
  (
    'CI', NULL, 20, 2.0, 4,
    '1977-01-01',
    '{"fr": "Ancienneté 20 ans (+4 jours)", "en": "20 years seniority (+4 days)"}'::jsonb,
    '{"fr": "Bonus de 4 jours après 20 ans de service (28 jours par an)", "en": "4 days bonus after 20 years of service (28 days per year)"}'::jsonb,
    'Convention Collective Article 28',
    5
  ),
  (
    'CI', NULL, 25, 2.0, 6,
    '1977-01-01',
    '{"fr": "Ancienneté 25 ans (+6 jours)", "en": "25 years seniority (+6 days)"}'::jsonb,
    '{"fr": "Bonus de 6 jours après 25 ans de service (30 jours par an)", "en": "6 days bonus after 25 years of service (30 days per year)"}'::jsonb,
    'Convention Collective Article 28',
    5
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- Overtime rates: Read-only for all, write for super_admin only
ALTER TABLE overtime_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view overtime rates" ON overtime_rates
  FOR SELECT
  USING (true);

CREATE POLICY "Only super_admin can modify overtime rates" ON overtime_rates
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');

-- Leave accrual rules: Read-only for all, write for super_admin only
ALTER TABLE leave_accrual_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view leave accrual rules" ON leave_accrual_rules
  FOR SELECT
  USING (true);

CREATE POLICY "Only super_admin can modify leave accrual rules" ON leave_accrual_rules
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View all overtime rates for Côte d'Ivoire
SELECT
  period_type,
  (display_name->>'fr') as nom_francais,
  rate_multiplier as taux,
  legal_minimum as minimum_legal,
  legal_reference
FROM overtime_rates
WHERE country_code = 'CI'
  AND effective_to IS NULL
ORDER BY
  CASE period_type
    WHEN 'weekday_41_48' THEN 1
    WHEN 'weekday_48_plus' THEN 2
    WHEN 'saturday' THEN 3
    WHEN 'sunday' THEN 4
    WHEN 'holiday' THEN 5
    WHEN 'night' THEN 6
  END;

-- View all leave accrual rules for Côte d'Ivoire
SELECT
  (display_name->>'fr') as nom_francais,
  age_threshold as age_seuil,
  seniority_years as annees_anciennete,
  days_per_month as jours_par_mois,
  bonus_days as jours_bonus,
  (days_per_month * 12 + bonus_days) as total_annuel,
  legal_reference
FROM leave_accrual_rules
WHERE country_code = 'CI'
  AND effective_to IS NULL
ORDER BY priority DESC, seniority_years NULLS FIRST, age_threshold NULLS FIRST;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update Drizzle schema with new tables
-- 2. Create tRPC endpoints (policies router)
-- 3. Build compliance validator service
-- 4. Implement UI for policy configuration
