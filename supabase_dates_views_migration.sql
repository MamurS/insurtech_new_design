-- ==============================================================================
-- DATES VIEWS MIGRATION
-- Adds date columns to consolidated views for Portfolio date filtering.
--
-- 1. Adds missing date columns to inward_reinsurance table
-- 2. Recreates v_direct_policies_consolidated with date columns
-- 3. Recreates v_inward_consolidated with date columns
-- 4. Recreates v_portfolio with date columns
--
-- Run this in the Supabase SQL Editor.
-- ==============================================================================

-- =============================================
-- Step 1: Add missing date columns to inward_reinsurance
-- =============================================
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS date_of_slip DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS accounting_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reinsurance_inception_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reinsurance_expiry_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS premium_payment_date TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS actual_payment_date TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS insurance_days INTEGER;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reinsurance_days INTEGER;

-- =============================================
-- Step 2: Drop dependent views (order matters)
-- =============================================
DROP VIEW IF EXISTS v_portfolio;
DROP VIEW IF EXISTS v_direct_policies_consolidated;
DROP VIEW IF EXISTS v_inward_consolidated;

-- =============================================
-- Step 3: Recreate v_direct_policies_consolidated with date columns
-- =============================================
CREATE OR REPLACE VIEW v_direct_policies_consolidated AS
SELECT
    MIN(id::text)::uuid AS id,
    "policyNumber"       AS policy_number,
    MIN("insuredName")   AS insured_name,
    MIN("brokerName")    AS broker_name,
    MIN("classOfInsurance") AS class_of_business,
    MIN(territory)       AS territory,
    MIN(currency)        AS currency,
    MIN("limitForeignCurrency") AS limit_fc,
    SUM("grossPremium")  AS gross_premium,
    SUM("netPremium")    AS net_premium,
    MIN("ourShare")      AS our_share,
    MIN("inceptionDate"::text) AS inception_date,
    MAX("expiryDate"::text)    AS expiry_date,
    MIN(status)          AS status,
    COUNT(*)             AS installment_count,
    'direct'::text       AS source,
    -- NEW: Date columns
    MIN("dateOfSlip"::text)          AS date_of_slip,
    MIN("accountingDate"::text)      AS accounting_date,
    MIN("premiumPaymentDate")        AS premium_payment_date,
    MIN("actualPaymentDate")         AS actual_payment_date
FROM policies
WHERE "recordType" = 'Direct'
  AND ("isDeleted" IS NULL OR "isDeleted" = false)
GROUP BY "policyNumber";

-- =============================================
-- Step 4: Recreate v_inward_consolidated with date columns
-- =============================================
CREATE OR REPLACE VIEW v_inward_consolidated AS
SELECT
    MIN(id::text)::uuid  AS id,
    contract_number,
    MIN(original_insured_name) AS original_insured_name,
    MIN(cedant_name)     AS cedant_name,
    MIN(broker_name)     AS broker_name,
    MIN(class_of_cover)  AS class_of_cover,
    MIN(territory)       AS territory,
    MIN(currency)        AS currency,
    MIN(limit_of_liability) AS limit_of_liability,
    SUM(gross_premium)   AS gross_premium,
    SUM(net_premium)     AS net_premium,
    MIN(our_share)       AS our_share,
    MIN(inception_date::text) AS inception_date,
    MAX(expiry_date::text)    AS expiry_date,
    MIN(status)          AS status,
    COUNT(*)             AS installment_count,
    CASE
        WHEN MIN(origin) = 'FOREIGN' THEN 'inward-foreign'
        ELSE 'inward-domestic'
    END::text            AS source,
    -- NEW: Date columns
    MIN(date_of_slip::text)              AS date_of_slip,
    MIN(accounting_date::text)           AS accounting_date,
    MIN(reinsurance_inception_date::text) AS reinsurance_inception_date,
    MIN(reinsurance_expiry_date::text)   AS reinsurance_expiry_date,
    MIN(premium_payment_date)            AS premium_payment_date,
    MIN(actual_payment_date)             AS actual_payment_date
FROM inward_reinsurance
WHERE is_deleted = false
GROUP BY contract_number;

-- =============================================
-- Step 5: Recreate v_portfolio with date columns
-- =============================================
CREATE OR REPLACE VIEW v_portfolio AS

-- Direct policies
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
    source,
    -- Date columns
    date_of_slip,
    accounting_date,
    NULL::text       AS reinsurance_inception_date,
    NULL::text       AS reinsurance_expiry_date,
    premium_payment_date,
    actual_payment_date
FROM v_direct_policies_consolidated

UNION ALL

-- Inward reinsurance
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
    source,
    -- Date columns
    date_of_slip,
    accounting_date,
    reinsurance_inception_date,
    reinsurance_expiry_date,
    premium_payment_date,
    actual_payment_date
FROM v_inward_consolidated;

-- =============================================
-- Step 6: Grant access
-- =============================================
GRANT SELECT ON v_direct_policies_consolidated TO anon, authenticated;
GRANT SELECT ON v_inward_consolidated TO anon, authenticated;
GRANT SELECT ON v_portfolio TO anon, authenticated;

-- Done
DO $$ BEGIN
    RAISE NOTICE 'Date views migration completed successfully!';
END $$;
