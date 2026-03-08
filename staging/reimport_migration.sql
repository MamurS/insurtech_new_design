-- =============================================
-- Mosaic ERP: Data Re-Import Migration
-- Run this BEFORE importing data from reimport_data.py
-- =============================================

-- Step 1: Add missing columns to inward_reinsurance
-- =============================================
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS agreement_number TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS borrower TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS retrocedent TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reference_link TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS sum_insured_fc NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS sum_insured_uzs NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS premium_fc NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS premium_nc NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS gross_premium_uzs NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS sum_reinsured_fc NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS sum_reinsured_uzs NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS commission_nc NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS tax_percent NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS net_premium_uzs NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS received_premium_currency TEXT;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS equivalent_usd NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS received_premium_uzs NUMERIC;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS number_of_slips INTEGER;

-- These may already exist from previous migration:
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS date_of_slip DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS accounting_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reinsurance_inception_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reinsurance_expiry_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS premium_payment_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS actual_payment_date DATE;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS insurance_days INTEGER;
ALTER TABLE inward_reinsurance ADD COLUMN IF NOT EXISTS reinsurance_days INTEGER;

-- Step 2: Truncate all data tables (order matters for FK constraints)
-- =============================================
TRUNCATE TABLE slips CASCADE;
TRUNCATE TABLE inward_reinsurance CASCADE;

-- For policies, only delete Direct and OUTWARD records (preserve other types if any)
DELETE FROM policies WHERE "recordType" IN ('Direct', 'OUTWARD', 'Outward', 'Reinsurance');

-- Step 3: Drop and recreate views (they depend on the tables)
-- =============================================
DROP VIEW IF EXISTS v_portfolio;
DROP VIEW IF EXISTS v_direct_policies_consolidated;
DROP VIEW IF EXISTS v_inward_consolidated;

-- Recreate v_direct_policies_consolidated
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
    MIN("dateOfSlip"::text)          AS date_of_slip,
    MIN("accountingDate"::text)      AS accounting_date,
    MIN("premiumPaymentDate")        AS premium_payment_date,
    MIN("actualPaymentDate")         AS actual_payment_date
FROM policies
WHERE "recordType" = 'Direct'
  AND ("isDeleted" IS NULL OR "isDeleted" = false)
GROUP BY "policyNumber";

-- Recreate v_inward_consolidated
-- Groups by agreement_number with fallback to contract_number
CREATE OR REPLACE VIEW v_inward_consolidated AS
SELECT
    MIN(id::text)::uuid  AS id,
    COALESCE(NULLIF(MIN(agreement_number), ''), contract_number) AS contract_number,
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
    MIN(date_of_slip::text)              AS date_of_slip,
    MIN(accounting_date::text)           AS accounting_date,
    MIN(reinsurance_inception_date::text) AS reinsurance_inception_date,
    MIN(reinsurance_expiry_date::text)   AS reinsurance_expiry_date,
    MIN(premium_payment_date)            AS premium_payment_date,
    MIN(actual_payment_date)             AS actual_payment_date
FROM inward_reinsurance
WHERE is_deleted = false
GROUP BY COALESCE(NULLIF(agreement_number, ''), contract_number);

-- Recreate v_portfolio
CREATE OR REPLACE VIEW v_portfolio AS
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
    date_of_slip,
    accounting_date,
    NULL::text       AS reinsurance_inception_date,
    NULL::text       AS reinsurance_expiry_date,
    premium_payment_date,
    actual_payment_date
FROM v_direct_policies_consolidated
UNION ALL
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
    date_of_slip,
    accounting_date,
    reinsurance_inception_date,
    reinsurance_expiry_date,
    premium_payment_date,
    actual_payment_date
FROM v_inward_consolidated;

-- Grant access
GRANT SELECT ON v_direct_policies_consolidated TO anon, authenticated;
GRANT SELECT ON v_inward_consolidated TO anon, authenticated;
GRANT SELECT ON v_portfolio TO anon, authenticated;
