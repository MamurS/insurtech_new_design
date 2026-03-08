
-- ==============================================================================
-- PORTFOLIO FIELDS MIGRATION SCRIPT
-- Run this in the Supabase SQL Editor to add new portfolio/Excel columns
-- to the policies table without losing data.
-- ==============================================================================

-- Add new Portfolio/Excel columns to POLICIES table
DO $$
BEGIN
    -- 1C Code (Accounting Code)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'accountingCode') THEN
        ALTER TABLE public.policies ADD COLUMN "accountingCode" text;
    END IF;

    -- Reference Link (to slip document)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'referenceLink') THEN
        ALTER TABLE public.policies ADD COLUMN "referenceLink" text;
    END IF;

    -- Exchange Rate in USD (cross-rate)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'exchangeRateUSD') THEN
        ALTER TABLE public.policies ADD COLUMN "exchangeRateUSD" numeric;
    END IF;

    -- Insurance Period - Number of Days
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'insuranceDays') THEN
        ALTER TABLE public.policies ADD COLUMN "insuranceDays" integer;
    END IF;

    -- Reinsurance Period - Number of Days
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'reinsuranceDays') THEN
        ALTER TABLE public.policies ADD COLUMN "reinsuranceDays" integer;
    END IF;

    -- Reinsurance Type ('%' for Proportional or 'XL' for Non-Proportional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'reinsuranceType') THEN
        ALTER TABLE public.policies ADD COLUMN "reinsuranceType" text;
    END IF;

    -- Premium in FC 100% (full premium before MIG share)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'fullPremiumForeign') THEN
        ALTER TABLE public.policies ADD COLUMN "fullPremiumForeign" numeric;
    END IF;

    -- Premium in NC 100%
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'fullPremiumNational') THEN
        ALTER TABLE public.policies ADD COLUMN "fullPremiumNational" numeric;
    END IF;

    -- Gross Reinsurance Premium NC
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'grossPremiumNational') THEN
        ALTER TABLE public.policies ADD COLUMN "grossPremiumNational" numeric;
    END IF;

    -- Commission amount in National Currency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'commissionNational') THEN
        ALTER TABLE public.policies ADD COLUMN "commissionNational" numeric;
    END IF;

    -- Net Reinsurance Premium NC
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'netPremiumNational') THEN
        ALTER TABLE public.policies ADD COLUMN "netPremiumNational" numeric;
    END IF;

    -- Premium Payment Date (scheduled)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'premiumPaymentDate') THEN
        ALTER TABLE public.policies ADD COLUMN "premiumPaymentDate" text;
    END IF;

    -- Currency of Received Premium
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'receivedPremiumCurrency') THEN
        ALTER TABLE public.policies ADD COLUMN "receivedPremiumCurrency" text;
    END IF;

    -- Exchange Rate at time of premium receipt
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'receivedPremiumExchangeRate') THEN
        ALTER TABLE public.policies ADD COLUMN "receivedPremiumExchangeRate" numeric;
    END IF;

    -- Actual Payment Date (when payment was received)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'actualPaymentDate') THEN
        ALTER TABLE public.policies ADD COLUMN "actualPaymentDate" text;
    END IF;

    -- Number of individual risks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'risksCount') THEN
        ALTER TABLE public.policies ADD COLUMN "risksCount" integer;
    END IF;

    -- Retrocession Sum Reinsured
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'retroSumReinsured') THEN
        ALTER TABLE public.policies ADD COLUMN "retroSumReinsured" numeric;
    END IF;

    -- Retrocession Premium
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'retroPremium') THEN
        ALTER TABLE public.policies ADD COLUMN "retroPremium" numeric;
    END IF;
END $$;

-- Add comment to table documenting the new columns
COMMENT ON COLUMN public.policies."accountingCode" IS '1C Code - accounting system reference';
COMMENT ON COLUMN public.policies."referenceLink" IS 'Reference link to slip document';
COMMENT ON COLUMN public.policies."exchangeRateUSD" IS 'Exchange rate in USD (cross-rate)';
COMMENT ON COLUMN public.policies."insuranceDays" IS 'Insurance period - number of days';
COMMENT ON COLUMN public.policies."reinsuranceDays" IS 'Reinsurance period - number of days';
COMMENT ON COLUMN public.policies."reinsuranceType" IS 'Reinsurance type: % (Proportional) or XL (Non-Proportional)';
COMMENT ON COLUMN public.policies."fullPremiumForeign" IS 'Premium in FC 100% (before MIG share)';
COMMENT ON COLUMN public.policies."fullPremiumNational" IS 'Premium in NC 100%';
COMMENT ON COLUMN public.policies."grossPremiumNational" IS 'Gross reinsurance premium in national currency';
COMMENT ON COLUMN public.policies."commissionNational" IS 'Commission amount in national currency';
COMMENT ON COLUMN public.policies."netPremiumNational" IS 'Net reinsurance premium in national currency';
COMMENT ON COLUMN public.policies."premiumPaymentDate" IS 'Scheduled premium payment date';
COMMENT ON COLUMN public.policies."receivedPremiumCurrency" IS 'Currency of received premium';
COMMENT ON COLUMN public.policies."receivedPremiumExchangeRate" IS 'Exchange rate at time of premium receipt';
COMMENT ON COLUMN public.policies."actualPaymentDate" IS 'When payment was actually received';
COMMENT ON COLUMN public.policies."risksCount" IS 'Number of individual risks';
COMMENT ON COLUMN public.policies."retroSumReinsured" IS 'Retrocession sum reinsured';
COMMENT ON COLUMN public.policies."retroPremium" IS 'Retrocession premium';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Portfolio fields migration completed successfully!';
    RAISE NOTICE 'Added 18 new columns to the policies table for Excel portfolio export.';
END $$;
