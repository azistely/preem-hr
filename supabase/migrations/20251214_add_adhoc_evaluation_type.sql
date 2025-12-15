-- Migration: Add Ad-Hoc Evaluation Type
-- Date: 2025-12-14
-- Description: Adds ad_hoc_type field to evaluations table and makes cycle_id nullable
--              for individual evaluations not tied to a formal performance cycle

-- ============================================================================
-- MODIFY evaluations TABLE
-- ============================================================================

-- Make cycle_id nullable for ad-hoc evaluations
ALTER TABLE evaluations
ALTER COLUMN cycle_id DROP NOT NULL;

-- Add ad_hoc_type column for categorizing individual evaluations
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS ad_hoc_type TEXT;

-- Add check constraint for valid ad_hoc_type values
ALTER TABLE evaluations
ADD CONSTRAINT chk_evaluation_ad_hoc_type
CHECK (ad_hoc_type IS NULL OR ad_hoc_type IN ('probation', 'cdd_renewal', 'cddti_check', 'other'));

-- Add comments
COMMENT ON COLUMN evaluations.ad_hoc_type IS 'Type of ad-hoc evaluation: probation (end of trial), cdd_renewal (CDD contract renewal), cddti_check (CDDTI evaluation), other';

-- Create index for ad-hoc evaluations queries
CREATE INDEX IF NOT EXISTS idx_evaluations_ad_hoc_type
ON evaluations(tenant_id, ad_hoc_type)
WHERE ad_hoc_type IS NOT NULL;

-- Create index for filtering ad-hoc vs cycle evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_is_ad_hoc
ON evaluations(tenant_id)
WHERE cycle_id IS NULL;
