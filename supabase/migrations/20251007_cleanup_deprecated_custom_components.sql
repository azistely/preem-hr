/**
 * Cleanup: Remove deprecated custom_salary_components table
 * 
 * Context: Option B architecture now uses tenant_salary_component_activations
 * All data has been migrated in 20251007_option_b_activations.sql
 * 
 * This migration:
 * 1. Drops the deprecated custom_salary_components table
 * 2. Removes related indexes and policies
 */

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view their tenant's custom components" ON custom_salary_components;
DROP POLICY IF EXISTS "Users can insert custom components for their tenant" ON custom_salary_components;
DROP POLICY IF EXISTS "Users can update their tenant's custom components" ON custom_salary_components;
DROP POLICY IF EXISTS "Users can delete their tenant's custom components" ON custom_salary_components;

-- Drop indexes
DROP INDEX IF EXISTS idx_custom_salary_components_tenant;
DROP INDEX IF EXISTS idx_custom_salary_components_code;

-- Drop the table
DROP TABLE IF EXISTS custom_salary_components CASCADE;

-- Add comment for audit trail
COMMENT ON TABLE tenant_salary_component_activations IS 
  'Replaced custom_salary_components (deprecated 2025-10-07). 
   Uses template references instead of full metadata copies.
   See docs/OPTION-B-ARCHITECTURE-SUMMARY.md';
