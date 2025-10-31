-- Migration: Add commune column to locations table
-- Allows specifying the commune or district within a city (e.g., Cocody, Yopougon for Abidjan)
-- This enables more precise location tracking for transport allowances and organizational reporting

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS commune VARCHAR(100);

-- Add column comment for documentation
COMMENT ON COLUMN locations.commune IS 'Commune or district within a city (e.g., Cocody, Yopougon for Abidjan)';

-- Add index for filtering by commune
CREATE INDEX IF NOT EXISTS idx_locations_commune ON locations(commune);
