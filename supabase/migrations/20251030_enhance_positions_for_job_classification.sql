-- Migration: Enhance positions table for job classification
-- Adds fields to distinguish between job function (Fonction) and job trade (Métier)

-- Add job classification fields to positions table
ALTER TABLE positions
  -- Job function (Fonction) - broader role category
  ADD COLUMN IF NOT EXISTS job_function VARCHAR(255),

  -- Job trade (Métier) - specific job/trade performed
  ADD COLUMN IF NOT EXISTS job_trade VARCHAR(255);

-- Add index for job function queries
CREATE INDEX IF NOT EXISTS idx_positions_job_function ON positions(job_function);

-- Add column comments
COMMENT ON COLUMN positions.title IS 'Official position title as defined by the organization';
COMMENT ON COLUMN positions.job_function IS 'Job function (Fonction) - broader role category (e.g., "Cadre", "Agent de maîtrise", "Employé")';
COMMENT ON COLUMN positions.job_trade IS 'Specific job/trade (Métier) - actual job performed (e.g., "Comptable", "Électricien", "Chauffeur")';
COMMENT ON COLUMN positions.job_level IS 'Hierarchical job level within the organization structure';
