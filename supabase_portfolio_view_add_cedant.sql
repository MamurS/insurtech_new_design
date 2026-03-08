-- ==============================================================================
-- ADD cedant_name TO v_portfolio VIEW
--
-- Purpose: Makes cedant name searchable in the Portfolio page.
-- The v_portfolio UNION maps COALESCE(original_insured_name, cedant_name)
-- as insured_name, so searching "Kafolat" (a cedant) won't match records
-- where original_insured_name is set (e.g. "SURHAN GAS CHEMICAL").
-- Adding cedant_name as a separate column allows the search query to
-- include it in the OR filter.
--
-- Run this in the Supabase SQL Editor.
-- ==============================================================================

-- Recreate v_portfolio with cedant_name column
DROP VIEW IF EXISTS v_portfolio;

CREATE OR REPLACE VIEW v_portfolio AS

-- Direct policies (no cedant_name — use NULL)
SELECT
    id,
    policy_number   AS reference_number,
    insured_name,
    broker_name,
    NULL::text       AS cedant_name,
    class_of_business,
    territory,
    currency,
    limit_fc         AS "limit",
    gross_premium,
    net_premium,
    our_share,
    inception_date,
    expiry_date,
    status,
    installment_count,
    source
FROM v_direct_policies_consolidated

UNION ALL

-- Inward reinsurance (has cedant_name)
SELECT
    id,
    contract_number  AS reference_number,
    COALESCE(original_insured_name, cedant_name) AS insured_name,
    broker_name,
    cedant_name,
    class_of_cover   AS class_of_business,
    territory,
    currency,
    limit_of_liability AS "limit",
    gross_premium,
    net_premium,
    our_share,
    inception_date,
    expiry_date,
    status,
    installment_count,
    source
FROM v_inward_consolidated;

-- Grant access (match existing permissions)
GRANT SELECT ON v_portfolio TO anon, authenticated;
