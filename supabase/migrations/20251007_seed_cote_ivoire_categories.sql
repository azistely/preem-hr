-- Seed Côte d'Ivoire employee categories
-- Based on Convention Collective Interprofessionnelle (1977)
-- Categories: A1, A2, B1, B2, C, D, E, F

INSERT INTO employee_category_coefficients (
  country_code,
  category_code,
  category_name,
  coefficient,
  legal_reference
) VALUES
  -- Category A1: Manœuvre ordinaire (Unskilled laborer)
  (
    'CI',
    'A1',
    '{"fr": "Manœuvre ordinaire", "en": "Unskilled laborer"}'::jsonb,
    90.00,
    'Convention Collective 1977 - Catégorie A1'
  ),

  -- Category A2: Manœuvre spécialisé (Semi-skilled laborer)
  (
    'CI',
    'A2',
    '{"fr": "Manœuvre spécialisé", "en": "Semi-skilled laborer"}'::jsonb,
    100.00,
    'Convention Collective 1977 - Catégorie A2'
  ),

  -- Category B1: Ouvrier qualifié (Qualified worker)
  (
    'CI',
    'B1',
    '{"fr": "Ouvrier qualifié", "en": "Qualified worker"}'::jsonb,
    120.00,
    'Convention Collective 1977 - Catégorie B1'
  ),

  -- Category B2: Ouvrier hautement qualifié (Highly qualified worker)
  (
    'CI',
    'B2',
    '{"fr": "Ouvrier hautement qualifié", "en": "Highly qualified worker"}'::jsonb,
    140.00,
    'Convention Collective 1977 - Catégorie B2'
  ),

  -- Category C: Agent de maîtrise (Supervisor/Foreman)
  (
    'CI',
    'C',
    '{"fr": "Agent de maîtrise", "en": "Supervisor/Foreman"}'::jsonb,
    170.00,
    'Convention Collective 1977 - Catégorie C'
  ),

  -- Category D: Cadre (Junior manager)
  (
    'CI',
    'D',
    '{"fr": "Cadre", "en": "Junior manager"}'::jsonb,
    220.00,
    'Convention Collective 1977 - Catégorie D'
  ),

  -- Category E: Cadre supérieur (Senior manager)
  (
    'CI',
    'E',
    '{"fr": "Cadre supérieur", "en": "Senior manager"}'::jsonb,
    300.00,
    'Convention Collective 1977 - Catégorie E'
  ),

  -- Category F: Dirigeant (Executive/Director)
  (
    'CI',
    'F',
    '{"fr": "Dirigeant", "en": "Executive/Director"}'::jsonb,
    450.00,
    'Convention Collective 1977 - Catégorie F'
  );

-- Verify the insert
SELECT
  category_code,
  category_name->>'fr' as name_fr,
  coefficient,
  (SELECT minimum_wage FROM countries WHERE code = 'CI') as min_wage,
  (SELECT minimum_wage FROM countries WHERE code = 'CI') * coefficient / 100 as calculated_min_salary
FROM employee_category_coefficients
WHERE country_code = 'CI'
ORDER BY coefficient ASC;
