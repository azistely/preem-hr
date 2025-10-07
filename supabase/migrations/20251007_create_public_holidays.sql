-- Fix P0 Gap #2: Create Public Holidays Table
--
-- Purpose:
-- 1. Track public holidays by country for overtime calculation (2.00x multiplier)
-- 2. Exclude holidays from business days in time-off calculations
-- 3. Support payroll compliance (holiday pay requirements)
--
-- Convention Collective Requirements:
-- - Holiday work pays 2.00x (Article 23)
-- - Holidays excluded from leave day calculations
-- - Multi-country support (CI, SN, BF, etc.)

BEGIN;

-- Create public_holidays table
CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  holiday_date DATE NOT NULL,
  name JSONB NOT NULL, -- {"fr": "Jour de l'An", "en": "New Year's Day"}
  description JSONB, -- Optional detailed description
  is_recurring BOOLEAN DEFAULT TRUE, -- TRUE = repeats yearly, FALSE = one-time
  is_paid BOOLEAN DEFAULT TRUE, -- Most public holidays are paid
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique holiday per country per date
  CONSTRAINT unique_country_holiday_date UNIQUE (country_code, holiday_date)
);

-- Add indexes for performance
CREATE INDEX idx_public_holidays_country_code ON public_holidays(country_code);
CREATE INDEX idx_public_holidays_date ON public_holidays(holiday_date);
CREATE INDEX idx_public_holidays_country_date ON public_holidays(country_code, holiday_date);

-- Enable RLS (Row Level Security)
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read public holidays (they're public data)
CREATE POLICY public_holidays_read_all ON public_holidays
  FOR SELECT
  USING (true);

-- RLS Policy: Only admins can insert/update/delete holidays
-- (This will be enforced at application level via service role key)

-- Add trigger for updated_at
CREATE TRIGGER update_public_holidays_updated_at
  BEFORE UPDATE ON public_holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed Côte d'Ivoire (CI) public holidays for 2025
INSERT INTO public_holidays (country_code, holiday_date, name, description, is_recurring, is_paid) VALUES
-- Fixed annual holidays
('CI', '2025-01-01',
  '{"fr": "Jour de l''An", "en": "New Year''s Day"}',
  '{"fr": "Célébration du nouvel an", "en": "New Year celebration"}',
  TRUE, TRUE),

('CI', '2025-05-01',
  '{"fr": "Fête du Travail", "en": "Labour Day"}',
  '{"fr": "Journée internationale des travailleurs", "en": "International Workers'' Day"}',
  TRUE, TRUE),

('CI', '2025-08-07',
  '{"fr": "Fête de l''Indépendance", "en": "Independence Day"}',
  '{"fr": "Indépendance de la Côte d''Ivoire (1960)", "en": "Ivory Coast Independence (1960)"}',
  TRUE, TRUE),

('CI', '2025-08-15',
  '{"fr": "Assomption", "en": "Assumption of Mary"}',
  '{"fr": "Assomption de la Vierge Marie", "en": "Assumption of the Virgin Mary"}',
  TRUE, TRUE),

('CI', '2025-11-01',
  '{"fr": "Toussaint", "en": "All Saints'' Day"}',
  '{"fr": "Fête de tous les saints", "en": "All Saints'' Day"}',
  TRUE, TRUE),

('CI', '2025-11-15',
  '{"fr": "Journée Nationale de la Paix", "en": "National Peace Day"}',
  '{"fr": "Commémoration de la paix en Côte d''Ivoire", "en": "Commemoration of peace in Ivory Coast"}',
  TRUE, TRUE),

('CI', '2025-12-25',
  '{"fr": "Noël", "en": "Christmas Day"}',
  '{"fr": "Naissance de Jésus-Christ", "en": "Birth of Jesus Christ"}',
  TRUE, TRUE),

-- Variable holidays (2025 specific - Easter-based)
('CI', '2025-04-18',
  '{"fr": "Vendredi Saint", "en": "Good Friday"}',
  '{"fr": "Vendredi avant Pâques", "en": "Friday before Easter"}',
  FALSE, TRUE),

('CI', '2025-04-21',
  '{"fr": "Lundi de Pâques", "en": "Easter Monday"}',
  '{"fr": "Lundi après Pâques", "en": "Monday after Easter"}',
  FALSE, TRUE),

('CI', '2025-05-29',
  '{"fr": "Ascension", "en": "Ascension Day"}',
  '{"fr": "Ascension de Jésus-Christ (40 jours après Pâques)", "en": "Ascension of Jesus Christ (40 days after Easter)"}',
  FALSE, TRUE),

('CI', '2025-06-09',
  '{"fr": "Lundi de Pentecôte", "en": "Whit Monday"}',
  '{"fr": "Lundi après la Pentecôte", "en": "Monday after Pentecost"}',
  FALSE, TRUE)

ON CONFLICT (country_code, holiday_date) DO NOTHING;

-- Seed CI holidays for 2026 (for testing multi-year)
INSERT INTO public_holidays (country_code, holiday_date, name, description, is_recurring, is_paid) VALUES
('CI', '2026-01-01', '{"fr": "Jour de l''An", "en": "New Year''s Day"}', NULL, TRUE, TRUE),
('CI', '2026-05-01', '{"fr": "Fête du Travail", "en": "Labour Day"}', NULL, TRUE, TRUE),
('CI', '2026-08-07', '{"fr": "Fête de l''Indépendance", "en": "Independence Day"}', NULL, TRUE, TRUE),
('CI', '2026-08-15', '{"fr": "Assomption", "en": "Assumption of Mary"}', NULL, TRUE, TRUE),
('CI', '2026-11-01', '{"fr": "Toussaint", "en": "All Saints'' Day"}', NULL, TRUE, TRUE),
('CI', '2026-11-15', '{"fr": "Journée Nationale de la Paix", "en": "National Peace Day"}', NULL, TRUE, TRUE),
('CI', '2026-12-25', '{"fr": "Noël", "en": "Christmas Day"}', NULL, TRUE, TRUE),
-- 2026 Easter-based holidays (Easter = April 5, 2026)
('CI', '2026-04-03', '{"fr": "Vendredi Saint", "en": "Good Friday"}', NULL, FALSE, TRUE),
('CI', '2026-04-06', '{"fr": "Lundi de Pâques", "en": "Easter Monday"}', NULL, FALSE, TRUE),
('CI', '2026-05-14', '{"fr": "Ascension", "en": "Ascension Day"}', NULL, FALSE, TRUE),
('CI', '2026-05-25', '{"fr": "Lundi de Pentecôte", "en": "Whit Monday"}', NULL, FALSE, TRUE)
ON CONFLICT (country_code, holiday_date) DO NOTHING;

COMMIT;

-- Verification query
SELECT
  country_code,
  holiday_date,
  (name->>'fr') as nom,
  CASE WHEN is_recurring THEN 'Annuel' ELSE 'Ponctuel' END as type
FROM public_holidays
WHERE country_code = 'CI'
  AND EXTRACT(YEAR FROM holiday_date) = 2025
ORDER BY holiday_date;

-- Summary
SELECT
  country_code as pays,
  EXTRACT(YEAR FROM holiday_date) as annee,
  COUNT(*) as nombre_jours_feries
FROM public_holidays
GROUP BY country_code, EXTRACT(YEAR FROM holiday_date)
ORDER BY country_code, annee;
