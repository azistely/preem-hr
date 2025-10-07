-- Migration: Seed employee categories for Côte d'Ivoire
-- Phase 1 of Architecture Analysis (Week 2)
-- Source: Convention Collective Interprofessionnelle de Côte d'Ivoire (1977)

-- Step 1: Insert Côte d'Ivoire employee categories (A1 → F)

-- Category A1: Ouvrier non qualifié
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'A1',
  'Ouvrier non qualifié',
  90,
  115,
  15, -- 15 days notice
  25, -- 2 hours/day on 8-hour workday = 25%
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Manoeuvre, aide non qualifié, gardien'
);

-- Category A2: Ouvrier qualifié
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'A2',
  'Ouvrier qualifié / Ouvrier spécialisé',
  120,
  145,
  15, -- 15 days notice
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Maçon, soudeur, mécanicien, chauffeur'
);

-- Category B1: Employé
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'B1',
  'Employé',
  150,
  180,
  15, -- 15 days notice (last category with 15 days)
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Secrétaire, comptable auxiliaire, vendeur'
);

-- Category B2: Employé qualifié
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'B2',
  'Employé qualifié / Technicien',
  190,
  225,
  30, -- 1 month notice
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Technicien, comptable confirmé, chef de rayon'
);

-- Category C: Agent de maîtrise
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'C',
  'Agent de maîtrise',
  240,
  335,
  30, -- 1 month notice
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Chef d''équipe, contremaître, technicien supérieur'
);

-- Category D: Cadre
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'D',
  'Cadre',
  350,
  505,
  90, -- 3 months notice
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Ingénieur, chef de service, responsable département'
);

-- Category E: Cadre supérieur
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'E',
  'Cadre supérieur',
  520,
  780,
  90, -- 3 months notice
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Directeur adjoint, chef de division, ingénieur principal'
);

-- Category F: Directeur
INSERT INTO employee_category_coefficients (
  country_code,
  category,
  label_fr,
  min_coefficient,
  max_coefficient,
  notice_period_days,
  notice_reduction_percent,
  minimum_wage_base,
  legal_reference,
  notes
) VALUES (
  'CI',
  'F',
  'Directeur / Cadre de direction',
  800,
  1000,
  90, -- 3 months notice
  25,
  'SMIG',
  'Convention Collective Interprofessionnelle Article 21',
  'Directeur général, directeur des opérations, membre CODIR'
);

-- Step 2: Verify insertion
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count
  FROM employee_category_coefficients
  WHERE country_code = 'CI';

  IF category_count != 8 THEN
    RAISE EXCEPTION 'Expected 8 categories for CI, found %', category_count;
  END IF;

  RAISE NOTICE 'Successfully seeded % employee categories for Côte d''Ivoire', category_count;
END $$;
