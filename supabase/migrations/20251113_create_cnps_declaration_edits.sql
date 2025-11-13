-- Create CNPS Declaration Edits Table
-- Stores manual edits made by users to CNPS monthly contribution declarations
-- Allows tracking of changes from automatically calculated values for audit purposes

CREATE TABLE IF NOT EXISTS cnps_declaration_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Declaration identifier (month + year + country)
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  country_code TEXT NOT NULL REFERENCES countries(code),

  -- Original calculated data (for reference and revert)
  original_data JSONB NOT NULL,

  -- User edits (only modified fields)
  edits JSONB NOT NULL,

  -- Edit metadata
  edit_reason TEXT,
  edited_by UUID NOT NULL,
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_cnps_declaration_edits_tenant ON cnps_declaration_edits(tenant_id);
CREATE INDEX idx_cnps_declaration_edits_period ON cnps_declaration_edits(tenant_id, year, month, country_code);
CREATE INDEX idx_cnps_declaration_edits_created_at ON cnps_declaration_edits(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE cnps_declaration_edits IS 'Stores manual edits to CNPS monthly contribution declarations with full audit trail';
COMMENT ON COLUMN cnps_declaration_edits.original_data IS 'Complete CNPSDeclarationData from calculator service before any edits';
COMMENT ON COLUMN cnps_declaration_edits.edits IS 'Modified fields only - merged with original_data for final declaration';
COMMENT ON COLUMN cnps_declaration_edits.edit_reason IS 'Optional reason provided by user for making the edit';
COMMENT ON COLUMN cnps_declaration_edits.edited_by IS 'User ID of person who made the edit';

-- Enable Row Level Security (RLS)
ALTER TABLE cnps_declaration_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant Isolation
-- Users can only see edits for their active tenant
CREATE POLICY tenant_isolation ON cnps_declaration_edits
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
