-- Migration: Add 'biometric' to time_entries.entry_source
-- Created: 2025-11-08
-- Purpose: Enable import of time entries from biometric devices (ZKTeco, Anviz, etc.)

-- Step 1: Drop the existing check constraint
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS check_entry_source;

-- Step 2: Add new check constraint including 'biometric'
ALTER TABLE time_entries
  ADD CONSTRAINT check_entry_source
  CHECK (entry_source = ANY (ARRAY['clock_in_out'::text, 'manual'::text, 'biometric'::text]));

-- Step 3: Add optional importMetadata column for storing device info, batch ID, original row number
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS import_metadata jsonb DEFAULT NULL;

-- Step 4: Add comment to document the new column
COMMENT ON COLUMN time_entries.import_metadata IS 'Stores metadata for imported entries: device_id, batch_id, original_row_number, device_type (zkteco/anviz/generic)';

-- Step 5: Create index for biometric entry reporting and filtering
CREATE INDEX IF NOT EXISTS idx_time_entries_biometric
  ON time_entries (tenant_id, entry_source, clock_in DESC)
  WHERE entry_source = 'biometric';

-- Step 6: Add comment to explain the index purpose
COMMENT ON INDEX idx_time_entries_biometric IS 'Optimizes queries for biometric import reporting and filtering';
