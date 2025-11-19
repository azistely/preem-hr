-- Add contract HTML content fields for Word-like contract editing
-- Migration: 20251118_add_contract_html_fields

-- Add contract_html_content to store editable HTML content
ALTER TABLE employment_contracts
ADD COLUMN contract_html_content TEXT;

-- Add contract_template_source to track content origin
ALTER TABLE employment_contracts
ADD COLUMN contract_template_source VARCHAR(50);

-- Add comment explaining the fields
COMMENT ON COLUMN employment_contracts.contract_html_content IS
'Stores the editable HTML content for the contract. This allows HR to edit contract content using a rich text editor instead of using hardcoded templates.';

COMMENT ON COLUMN employment_contracts.contract_template_source IS
'Tracks how the contract content was created: blank (started from empty), previous (copied from another contract), or system_default (used hardcoded template).';

-- Create index on template_source for filtering
CREATE INDEX IF NOT EXISTS idx_employment_contracts_template_source
ON employment_contracts(contract_template_source)
WHERE contract_template_source IS NOT NULL;
