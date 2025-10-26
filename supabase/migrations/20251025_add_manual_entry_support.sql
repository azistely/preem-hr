-- Migration: Add manual entry support to time_entries table
-- Author: AI Assistant
-- Date: 2025-10-25
-- Description: Add entry_source field and support for manual time entry

-- Add entry_source column to distinguish manual entries from clock in/out
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'clock_in_out';

-- Add comment
COMMENT ON COLUMN time_entries.entry_source IS 'Source of entry: clock_in_out (automatic) or manual (manager/HR entered)';

-- Add check constraint to ensure valid entry_source values
ALTER TABLE time_entries
ADD CONSTRAINT check_entry_source CHECK (entry_source IN ('clock_in_out', 'manual'));

-- For manual entries, clock_in and clock_out can be on the same date/time
-- The total_hours field will contain the actual hours worked

-- Add index for filtering by entry_source
CREATE INDEX IF NOT EXISTS idx_time_entries_entry_source ON time_entries(tenant_id, entry_source);

-- Add overtime_breakdown JSONB column if it doesn't exist
-- This stores the detailed overtime breakdown from overtime.service.ts
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS overtime_breakdown JSONB;

COMMENT ON COLUMN time_entries.overtime_breakdown IS 'Overtime classification: {hours_41_to_46, hours_above_46, night_work, weekend_work}';
