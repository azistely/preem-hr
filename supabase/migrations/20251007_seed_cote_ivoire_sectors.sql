-- Seed Côte d'Ivoire sector configurations
-- Based on Convention Collective Interprofessionnelle (1977)

INSERT INTO sector_configurations (
  country_code,
  sector_code,
  sector_name,
  work_accident_rate,
  required_components,
  smart_defaults
) VALUES
  -- CONSTRUCTION sector (highest work accident risk)
  (
    'CI',
    'CONSTRUCTION',
    'BTP et Construction',
    0.0400, -- 4% work accident rate (high risk)
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": true,
      "typical_positions": ["Maçon", "Charpentier", "Chef de Chantier", "Ingénieur BTP"],
      "min_coefficient": 120
    }'::jsonb
  ),

  -- AGRICULTURE sector (moderate-high risk)
  (
    'CI',
    'AGRICULTURE',
    'Agriculture et Agro-industrie',
    0.0300, -- 3% work accident rate
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": true,
      "typical_positions": ["Ouvrier Agricole", "Chef de Culture", "Ingénieur Agronome"],
      "seasonal_workers": true
    }'::jsonb
  ),

  -- INDUSTRY sector (moderate risk)
  (
    'CI',
    'INDUSTRY',
    'Industrie et Manufacture',
    0.0250, -- 2.5% work accident rate
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": true,
      "typical_positions": ["Opérateur Machine", "Technicien", "Ingénieur Production"],
      "shift_work_common": true
    }'::jsonb
  ),

  -- TRANSPORT sector (moderate-high risk)
  (
    'CI',
    'TRANSPORT',
    'Transport et Logistique',
    0.0350, -- 3.5% work accident rate
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": true,
      "typical_positions": ["Chauffeur", "Livreur", "Responsable Logistique"],
      "vehicle_allowance_common": true
    }'::jsonb
  ),

  -- COMMERCE sector (low risk)
  (
    'CI',
    'COMMERCE',
    'Commerce et Distribution',
    0.0150, -- 1.5% work accident rate (low risk)
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": false,
      "typical_positions": ["Vendeur", "Caissier", "Chef de Rayon", "Directeur Commercial"],
      "commission_common": true
    }'::jsonb
  ),

  -- SERVICES sector (lowest risk, default)
  (
    'CI',
    'SERVICES',
    'Services et Tertiaire',
    0.0100, -- 1% work accident rate (minimal risk)
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": false,
      "typical_positions": ["Assistant", "Comptable", "Responsable RH", "Directeur"],
      "office_environment": true
    }'::jsonb
  ),

  -- HOSPITALITY sector (low-moderate risk)
  (
    'CI',
    'HOSPITALITY',
    'Hôtellerie et Restauration',
    0.0200, -- 2% work accident rate
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": true,
      "typical_positions": ["Cuisinier", "Serveur", "Réceptionniste", "Chef"],
      "tips_common": true,
      "irregular_hours": true
    }'::jsonb
  ),

  -- EDUCATION sector (very low risk)
  (
    'CI',
    'EDUCATION',
    'Éducation et Formation',
    0.0050, -- 0.5% work accident rate (very low risk)
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": false,
      "typical_positions": ["Professeur", "Instituteur", "Formateur", "Directeur Pédagogique"],
      "academic_calendar": true
    }'::jsonb
  ),

  -- HEALTH sector (moderate risk due to biological exposure)
  (
    'CI',
    'HEALTH',
    'Santé et Services Médicaux',
    0.0250, -- 2.5% work accident rate
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": true,
      "typical_positions": ["Infirmier", "Médecin", "Aide-Soignant", "Administrateur Santé"],
      "shift_work_common": true,
      "biological_risk": true
    }'::jsonb
  ),

  -- FINANCE sector (very low risk)
  (
    'CI',
    'FINANCE',
    'Banque et Assurance',
    0.0050, -- 0.5% work accident rate (very low risk)
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": false,
      "typical_positions": ["Chargé de Clientèle", "Analyste Crédit", "Directeur Agence"],
      "high_security": true,
      "performance_bonuses_common": true
    }'::jsonb
  ),

  -- TECHNOLOGY sector (very low risk)
  (
    'CI',
    'TECHNOLOGY',
    'Technologies et Télécoms',
    0.0050, -- 0.5% work accident rate (very low risk)
    '["CNPS_PENSION", "CNPS_FAMILY", "CNPS_WORK_ACCIDENT", "FNE", "FDFP"]'::jsonb,
    '{
      "overtime_common": false,
      "typical_positions": ["Développeur", "Technicien IT", "Chef de Projet", "CTO"],
      "remote_work_possible": true,
      "project_bonuses_common": true
    }'::jsonb
  );

-- Verify the insert
SELECT
  sector_code,
  sector_name,
  work_accident_rate,
  jsonb_array_length(required_components) as num_required_components
FROM sector_configurations
WHERE country_code = 'CI'
ORDER BY work_accident_rate DESC;
