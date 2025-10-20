-- Mark base salary components in metadata for multi-country support
-- For CI: Code 11 (Salaire catégoriel) and Code 12 (Sursalaire)
-- For other countries: Will be configured when adding those countries

-- Update Code 11 (Salaire catégoriel) - CI
UPDATE salary_component_definitions
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{isBaseComponent}',
          'true'::jsonb
        ),
        '{baseComponentOrder}',
        '1'::jsonb
      ),
      '{baseComponentLabel}',
      '{"fr": "Salaire catégoriel (Code 11)", "en": "Category Salary (Code 11)"}'::jsonb
    ),
    '{baseComponentDescription}',
    '{"fr": "Salaire de base selon votre catégorie (A, B, C, D, E)", "en": "Base salary according to your category (A, B, C, D, E)"}'::jsonb
  ),
  '{isOptional}',
  'false'::jsonb
)
WHERE country_code = 'CI' AND code = '11';

-- Update Code 12 (Sursalaire) - CI
UPDATE salary_component_definitions
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{isBaseComponent}',
            'true'::jsonb
          ),
          '{baseComponentOrder}',
          '2'::jsonb
        ),
        '{baseComponentLabel}',
        '{"fr": "Sursalaire (Code 12)", "en": "Additional Salary (Code 12)"}'::jsonb
      ),
      '{baseComponentDescription}',
      '{"fr": "Montant additionnel au-delà du salaire catégoriel (optionnel)", "en": "Additional amount beyond category salary (optional)"}'::jsonb
    ),
    '{isOptional}',
    'true'::jsonb
  ),
  '{defaultValue}',
  '0'::jsonb
)
WHERE country_code = 'CI' AND code = '12';

-- Verify update
SELECT
  code,
  name->>'fr' as name_fr,
  component_type,
  metadata->'isBaseComponent' as is_base_component,
  metadata->'baseComponentOrder' as order,
  metadata->'baseComponentLabel'->>'fr' as label_fr,
  metadata->'isOptional' as is_optional
FROM salary_component_definitions
WHERE country_code = 'CI'
  AND code IN ('11', '12')
ORDER BY code;
