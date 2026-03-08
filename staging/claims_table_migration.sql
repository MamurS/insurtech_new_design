-- ==============================================================================
-- CLAIMS TABLE MIGRATION FOR EXCEL IMPORT
-- Run this in Supabase SQL Editor BEFORE importing claims
-- ==============================================================================

-- Make policy_id nullable (claims can link to inward_reinsurance instead)
ALTER TABLE public.claims ALTER COLUMN policy_id DROP NOT NULL;

-- Add new columns for linking and reference
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS inward_reinsurance_id UUID REFERENCES public.inward_reinsurance(id);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS slip_number TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_claims_inward_reinsurance ON public.claims(inward_reinsurance_id);
CREATE INDEX IF NOT EXISTS idx_claims_source_type ON public.claims(source_type);
CREATE INDEX IF NOT EXISTS idx_claims_slip_number ON public.claims(slip_number);
CREATE INDEX IF NOT EXISTS idx_claims_contract_number ON public.claims(contract_number);

-- Verify changes
SELECT
    column_name,
    data_type,
    is_nullable
FROM
    information_schema.columns
WHERE
    table_name = 'claims'
    AND column_name IN ('policy_id', 'inward_reinsurance_id', 'source_type', 'slip_number', 'contract_number')
ORDER BY
    column_name;
