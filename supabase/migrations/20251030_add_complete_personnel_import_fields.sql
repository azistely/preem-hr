-- Migration: Add all remaining personnel record fields for employee import
-- Adds fields from SAGE export that don't exist yet in employees table
-- Total: ~15 additional fields needed for complete 45-field import support

-- Personal information fields
ALTER TABLE employees
  -- Nationality (not just nationality_zone)
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),

  -- Emergency contact phone (name already exists from previous migration)
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);

-- Employment details
ALTER TABLE employees
  -- Contract and employment classification
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50), -- CDI, CDD, INTERIM, STAGE, etc.
  ADD COLUMN IF NOT EXISTS job_title TEXT, -- "Fonction" from SAGE
  ADD COLUMN IF NOT EXISTS profession TEXT, -- "Métier" from SAGE
  ADD COLUMN IF NOT EXISTS qualification VARCHAR(100), -- Qualification level
  ADD COLUMN IF NOT EXISTS employment_classification VARCHAR(50), -- "Type Emploi" - Temps plein/partiel/occasionnel
  ADD COLUMN IF NOT EXISTS salary_regime VARCHAR(50); -- Mensuel/Journalier/Horaire

-- Organizational structure (denormalized for import simplicity)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_site TEXT, -- "Site de travail"
  ADD COLUMN IF NOT EXISTS section TEXT, -- "Section"
  ADD COLUMN IF NOT EXISTS service TEXT, -- "Service"
  ADD COLUMN IF NOT EXISTS division TEXT, -- "Direction"
  ADD COLUMN IF NOT EXISTS establishment TEXT; -- "Etablissement"

-- Social security and health
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS cmu_number TEXT, -- N° CMU (Universal Health Coverage)
  ADD COLUMN IF NOT EXISTS health_coverage TEXT; -- Type of health coverage

-- Compensation (temporary fields for import - will link to compensation table later)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS categorical_salary NUMERIC(15, 2), -- "Salaire Catégoriel"
  ADD COLUMN IF NOT EXISTS salary_premium NUMERIC(15, 2), -- "Sursalaire"
  ADD COLUMN IF NOT EXISTS initial_leave_balance NUMERIC(5, 2); -- "Solde congés" at hire

-- Add indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_employees_contract_type ON employees(contract_type);
CREATE INDEX IF NOT EXISTS idx_employees_establishment ON employees(establishment);
CREATE INDEX IF NOT EXISTS idx_employees_division ON employees(division);
CREATE INDEX IF NOT EXISTS idx_employees_work_site ON employees(work_site);
CREATE INDEX IF NOT EXISTS idx_employees_cmu_number ON employees(cmu_number);

-- Add column comments for documentation
COMMENT ON COLUMN employees.nationality IS 'Full nationality name (e.g., Ivoirienne, Malienne, Française)';
COMMENT ON COLUMN employees.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN employees.contract_type IS 'Contract type: CDI (permanent), CDD (fixed-term), INTERIM (temporary), STAGE (internship)';
COMMENT ON COLUMN employees.job_title IS 'Job function/title (Fonction) - e.g., Directeur Général, Responsable RH';
COMMENT ON COLUMN employees.profession IS 'Professional field (Métier) - e.g., Resources Humaines, Comptabilité';
COMMENT ON COLUMN employees.qualification IS 'Professional qualification level - e.g., Cadre supérieur, Agent de maîtrise, Employé qualifié';
COMMENT ON COLUMN employees.employment_classification IS 'Employment type: Temps plein (full-time), Temps partiel (part-time), Occasionnel (casual)';
COMMENT ON COLUMN employees.salary_regime IS 'Salary payment frequency: Mensuel (monthly), Journalier (daily), Horaire (hourly)';
COMMENT ON COLUMN employees.work_site IS 'Physical work location - e.g., Abidjan Plateau, Abidjan Marcory';
COMMENT ON COLUMN employees.section IS 'Organizational section - smallest unit in hierarchy';
COMMENT ON COLUMN employees.service IS 'Department/service within the organization';
COMMENT ON COLUMN employees.division IS 'Division/Direction - major organizational unit';
COMMENT ON COLUMN employees.establishment IS 'Legal establishment/entity - e.g., Siège social, Filiale';
COMMENT ON COLUMN employees.cmu_number IS 'CMU (Couverture Maladie Universelle) number for universal health coverage in Côte d''Ivoire';
COMMENT ON COLUMN employees.health_coverage IS 'Type of health coverage: Aucune, CMU, Assurance privée, etc.';
COMMENT ON COLUMN employees.categorical_salary IS 'Base salary by category (Salaire Catégoriel) - imported value, will migrate to compensation table';
COMMENT ON COLUMN employees.salary_premium IS 'Additional salary premium (Sursalaire) - imported value, will migrate to compensation table';
COMMENT ON COLUMN employees.initial_leave_balance IS 'Leave balance at time of hire - imported value, will migrate to leave_balances table';
