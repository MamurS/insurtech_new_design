
-- ==============================================================================
-- MIGRATION SCRIPT
-- Run this in the Supabase SQL Editor to update your existing database
-- without losing data.
-- ==============================================================================

-- 1. Update SLIPS Table (Add Limit of Liability & Currency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slips' AND column_name = 'limitOfLiability') THEN
        ALTER TABLE public.slips ADD COLUMN "limitOfLiability" numeric;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slips' AND column_name = 'currency') THEN
        ALTER TABLE public.slips ADD COLUMN currency text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slips' AND column_name = 'reinsurers') THEN
        ALTER TABLE public.slips ADD COLUMN "reinsurers" jsonb default '[]'::jsonb;
    END IF;
END $$;

-- 2. Update POLICIES Table (Ensure Limit Columns exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'limitForeignCurrency') THEN
        ALTER TABLE public.policies ADD COLUMN "limitForeignCurrency" numeric;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'limitNationalCurrency') THEN
        ALTER TABLE public.policies ADD COLUMN "limitNationalCurrency" numeric;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'reinsurers') THEN
        ALTER TABLE public.policies ADD COLUMN "reinsurers" jsonb default '[]'::jsonb;
    END IF;
END $$;

-- 3. Create LEGAL ENTITIES Table (If missing)
CREATE TABLE IF NOT EXISTS public.legal_entities (
  id uuid default uuid_generate_v4() primary key,
  "fullName" text,
  "shortName" text,
  type text,
  "regCodeType" text,
  "regCodeValue" text,
  country text,
  city text,
  address text,
  phone text,
  email text,
  website text,
  shareholders text,
  "lineOfBusiness" text,
  "directorName" text,
  "bankName" text,
  "bankAccount" text,
  "bankMFO" text,
  "bankAddress" text,
  "isDeleted" boolean default false,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone
);

-- Enable RLS for Legal Entities
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.legal_entities;
CREATE POLICY "Enable all access for authenticated users" ON public.legal_entities FOR ALL USING (auth.role() = 'authenticated');

-- 4. Create ENTITY LOGS Table (If missing)
CREATE TABLE IF NOT EXISTS public.entity_logs (
  id uuid default uuid_generate_v4() primary key,
  "entityId" text, 
  "userId" text,
  "userName" text,
  action text,
  changes text, -- JSON string
  timestamp timestamp with time zone
);

-- Enable RLS for Logs
ALTER TABLE public.entity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.entity_logs;
CREATE POLICY "Enable all access for authenticated users" ON public.entity_logs FOR ALL USING (auth.role() = 'authenticated');

-- 5. Create FX RATES Table (If missing)
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid default uuid_generate_v4() primary key,
  currency text,
  rate numeric,
  date date
);

-- Enable RLS for FX Rates
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.fx_rates;
CREATE POLICY "Enable all access for authenticated users" ON public.fx_rates FOR ALL USING (auth.role() = 'authenticated');
