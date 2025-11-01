-- Add CDDTI to valid contract types check constraint
-- This allows creating CDDTI (Contrat à Durée Déterminée à Terme Imprécis / Daily Worker) contracts
-- CDDTI contracts have indefinite term like CDI, so they don't require an end date

-- Drop the old constraints
ALTER TABLE employment_contracts
DROP CONSTRAINT IF EXISTS valid_contract_type;

ALTER TABLE employment_contracts
DROP CONSTRAINT IF EXISTS valid_cdd_end_date;

-- Add the new constraint with CDDTI included
ALTER TABLE employment_contracts
ADD CONSTRAINT valid_contract_type
CHECK (contract_type IN ('CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE'));

-- Update end date constraint: CDI and CDDTI don't require end date, others do
ALTER TABLE employment_contracts
ADD CONSTRAINT valid_cdd_end_date
CHECK (
  (contract_type IN ('CDI', 'CDDTI') AND end_date IS NULL) OR
  (contract_type IN ('CDD', 'INTERIM', 'STAGE') AND end_date IS NOT NULL)
);
