-- ==============================================================================
-- MOSAIC ERP - COMPLETE STAGING DATABASE SCHEMA
-- Run this in Supabase SQL Editor to set up a fresh staging environment
-- Consolidated from all production migrations - Idempotent & Self-Contained
-- ==============================================================================

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- ENUMS (Claims Module)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE public.claim_liability_type AS ENUM ('INFORMATIONAL', 'ACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.claim_status AS ENUM ('OPEN', 'CLOSED', 'REOPENED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.claim_transaction_type AS ENUM ('RESERVE_SET', 'PAYMENT', 'RECOVERY', 'LEGAL_FEE', 'ADJUSTER_FEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 1. USERS TABLE (camelCase columns)
-- Profile data linked to Supabase Auth
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'Viewer',
    "avatarUrl" TEXT,
    permissions JSONB,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    department TEXT,
    phone TEXT,
    "isActive" BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All Read Access" ON public.users;
CREATE POLICY "Allow All Read Access" ON public.users FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.users;
CREATE POLICY "Admins can update all profiles" ON public.users FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('Super Admin', 'Admin'))
);

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.users;
CREATE POLICY "Admins can insert profiles" ON public.users FOR INSERT WITH CHECK (TRUE);

GRANT SELECT ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO authenticated, service_role;

-- ==============================================================================
-- 2. POLICIES TABLE (camelCase columns)
-- Core insurance policy records - includes all portfolio migration fields
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Core Architecture
    "channel" TEXT,
    "intermediaryType" TEXT,
    "intermediaryName" TEXT,

    -- Legacy Architecture (Backwards Compat)
    "recordType" TEXT,
    "brokerName" TEXT,

    -- Identifiers
    "policyNumber" TEXT,
    "secondaryPolicyNumber" TEXT,
    "slipNumber" TEXT,
    "agreementNumber" TEXT,
    "bordereauNo" TEXT,
    "invoiceIssued" BOOLEAN,
    "coverNote" TEXT,

    -- Dates
    "dateOfSlip" DATE,
    "accountingDate" DATE,
    "inceptionDate" DATE,
    "expiryDate" DATE,
    "issueDate" DATE,
    "reinsuranceInceptionDate" DATE,
    "reinsuranceExpiryDate" DATE,
    "paymentDate" DATE,
    "warrantyPeriod" INTEGER,
    "activationDate" TIMESTAMP WITH TIME ZONE,

    -- Parties
    "insuredName" TEXT,
    "insuredAddress" TEXT,
    "borrower" TEXT,
    "cedantName" TEXT,
    "retrocedent" TEXT,
    "reinsurerName" TEXT,
    "performer" TEXT,

    -- Risk Details
    industry TEXT,
    territory TEXT,
    city TEXT,
    jurisdiction TEXT,
    "classOfInsurance" TEXT,
    "typeOfInsurance" TEXT,
    "riskCode" TEXT,
    "insuredRisk" TEXT,

    -- Financials (Base)
    currency TEXT,
    "sumInsured" NUMERIC,
    "grossPremium" NUMERIC,
    "exchangeRate" NUMERIC,
    "equivalentUSD" NUMERIC,

    -- Financials (Extended / National Currency)
    "sumInsuredNational" NUMERIC,
    "premiumNationalCurrency" NUMERIC,

    -- Limits & Excess
    "limitForeignCurrency" NUMERIC,
    "limitNationalCurrency" NUMERIC,
    "excessForeignCurrency" NUMERIC,
    "prioritySum" NUMERIC,

    "premiumRate" NUMERIC,

    -- Our Share / Net
    "ourShare" NUMERIC,
    "netPremium" NUMERIC,
    "commissionPercent" NUMERIC,
    "taxPercent" NUMERIC,
    deductible TEXT,
    conditions TEXT,

    -- Outward Reinsurance
    "hasOutwardReinsurance" BOOLEAN DEFAULT FALSE,
    "reinsurers" JSONB DEFAULT '[]'::JSONB,
    "reinsuranceCommission" NUMERIC,
    "netReinsurancePremium" NUMERIC,
    "cededShare" NUMERIC,

    "cededPremiumForeign" NUMERIC,
    "cededPremiumNational" NUMERIC,

    "sumReinsuredForeign" NUMERIC,
    "sumReinsuredNational" NUMERIC,

    "receivedPremiumForeign" NUMERIC,
    "receivedPremiumNational" NUMERIC,

    "numberOfSlips" INTEGER,

    -- Treaty / Inward Specifics
    "treatyPlacement" TEXT,
    "treatyPremium" NUMERIC,
    "aicCommission" NUMERIC,
    "aicRetention" NUMERIC,
    "aicPremium" NUMERIC,
    "maxRetentionPerRisk" NUMERIC,
    "reinsurerRating" TEXT,

    -- Status & Tracking
    status TEXT,
    "paymentStatus" TEXT,
    installments JSONB DEFAULT '[]'::JSONB,
    claims JSONB DEFAULT '[]'::JSONB,
    "selectedClauseIds" TEXT[] DEFAULT '{}',
    "isDeleted" BOOLEAN DEFAULT FALSE,

    "signedDocument" JSONB,
    "terminationDetails" JSONB,

    -- ========================================
    -- Portfolio Migration Fields (18 new)
    -- ========================================
    "accountingCode" TEXT,
    "referenceLink" TEXT,
    "exchangeRateUSD" NUMERIC,
    "insuranceDays" INTEGER,
    "reinsuranceDays" INTEGER,
    "reinsuranceType" TEXT,
    "fullPremiumForeign" NUMERIC,
    "fullPremiumNational" NUMERIC,
    "grossPremiumNational" NUMERIC,
    "commissionNational" NUMERIC,
    "netPremiumNational" NUMERIC,
    "premiumPaymentDate" TEXT,
    "receivedPremiumCurrency" TEXT,
    "receivedPremiumExchangeRate" NUMERIC,
    "actualPaymentDate" TEXT,
    "risksCount" INTEGER,
    "retroSumReinsured" NUMERIC,
    "retroPremium" NUMERIC,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.policies;
CREATE POLICY "Enable all access for authenticated users" ON public.policies FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 3. CLAUSES TABLE (camelCase columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clauses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    "isStandard" BOOLEAN DEFAULT FALSE,
    category TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

ALTER TABLE public.clauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.clauses;
CREATE POLICY "Enable all access for authenticated users" ON public.clauses FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 4. SLIPS TABLE (camelCase columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.slips (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "slipNumber" TEXT NOT NULL,
    date DATE,
    "insuredName" TEXT,
    "brokerReinsurer" TEXT,
    "reinsurers" JSONB DEFAULT '[]'::JSONB,
    "limitOfLiability" NUMERIC,
    currency TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

ALTER TABLE public.slips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.slips;
CREATE POLICY "Enable all access for authenticated users" ON public.slips FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 5. TEMPLATES TABLE (camelCase columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.templates (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    content TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.templates;
CREATE POLICY "Enable all access for authenticated users" ON public.templates FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 6. LEGAL ENTITIES TABLE (camelCase columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.legal_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "fullName" TEXT,
    "shortName" TEXT,
    type TEXT,
    "regCodeType" TEXT,
    "regCodeValue" TEXT,
    country TEXT,
    city TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    shareholders TEXT,
    "lineOfBusiness" TEXT,
    "directorName" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankMFO" TEXT,
    "bankAddress" TEXT,
    "isDeleted" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE,
    "updatedAt" TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.legal_entities;
CREATE POLICY "Enable all access for authenticated users" ON public.legal_entities FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 7. ENTITY LOGS TABLE (camelCase columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.entity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    "entityId" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    action TEXT,
    changes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.entity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.entity_logs;
CREATE POLICY "Enable all access for authenticated users" ON public.entity_logs FOR ALL USING (auth.role() = 'authenticated');
GRANT SELECT ON TABLE public.entity_logs TO anon, authenticated;

-- ==============================================================================
-- 8. FX RATES TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fx_rates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    currency TEXT,
    rate NUMERIC,
    date DATE
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.fx_rates;
CREATE POLICY "Enable all access for authenticated users" ON public.fx_rates FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 9. CLAIMS TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,

    claim_number TEXT NOT NULL,
    liability_type public.claim_liability_type NOT NULL DEFAULT 'INFORMATIONAL',
    status public.claim_status NOT NULL DEFAULT 'OPEN',

    loss_date DATE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_date DATE,

    description TEXT,
    claimant_name TEXT,
    location_country TEXT,

    imported_total_incurred NUMERIC DEFAULT 0,
    imported_total_paid NUMERIC DEFAULT 0,

    legacy_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_policy ON public.claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_loss_date ON public.claims(loss_date);
CREATE INDEX IF NOT EXISTS idx_claims_type ON public.claims(liability_type);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View Claims" ON public.claims;
CREATE POLICY "View Claims" ON public.claims FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Create Informational Claims" ON public.claims;
CREATE POLICY "Create Informational Claims" ON public.claims FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Update Claims" ON public.claims;
CREATE POLICY "Update Claims" ON public.claims FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Delete Claims" ON public.claims;
CREATE POLICY "Delete Claims" ON public.claims FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 10. CLAIM TRANSACTIONS TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.claim_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,

    transaction_type public.claim_transaction_type NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

    amount_100pct NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate NUMERIC DEFAULT 1,

    our_share_percentage NUMERIC NOT NULL,
    amount_our_share NUMERIC GENERATED ALWAYS AS (amount_100pct * (our_share_percentage / 100)) STORED,

    payee TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_claim_trans_claim ON public.claim_transactions(claim_id);

ALTER TABLE public.claim_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Manage Transactions" ON public.claim_transactions;
CREATE POLICY "Manage Transactions" ON public.claim_transactions FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 11. CLAIM DOCUMENTS TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.claim_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Manage Documents" ON public.claim_documents;
CREATE POLICY "Manage Documents" ON public.claim_documents FOR ALL USING (auth.role() = 'authenticated');

-- ==============================================================================
-- 12. INWARD REINSURANCE PRESETS TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inward_reinsurance_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('TYPE_OF_COVER', 'CLASS_OF_COVER', 'INDUSTRY')),
    value TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presets_category ON public.inward_reinsurance_presets(category);
CREATE INDEX IF NOT EXISTS idx_presets_active ON public.inward_reinsurance_presets(is_active);

ALTER TABLE public.inward_reinsurance_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.inward_reinsurance_presets;
CREATE POLICY "Enable read for authenticated users" ON public.inward_reinsurance_presets FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Enable write for authenticated users" ON public.inward_reinsurance_presets;
CREATE POLICY "Enable write for authenticated users" ON public.inward_reinsurance_presets FOR ALL TO authenticated USING (TRUE);

GRANT ALL ON public.inward_reinsurance_presets TO authenticated;

-- ==============================================================================
-- 13. INWARD REINSURANCE TABLE (snake_case columns)
-- NOTE: created_by is bare UUID without FK (production had FK to non-existent 'profiles')
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inward_reinsurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number TEXT NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('FOREIGN', 'DOMESTIC')),
    type TEXT NOT NULL CHECK (type IN ('FAC', 'TREATY')),
    structure TEXT NOT NULL CHECK (structure IN ('PROPORTIONAL', 'NON_PROPORTIONAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),

    cedant_name TEXT NOT NULL,
    cedant_entity_id UUID REFERENCES public.legal_entities(id),
    cedant_country TEXT,
    broker_name TEXT,
    broker_entity_id UUID REFERENCES public.legal_entities(id),

    inception_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    uw_year INTEGER,

    type_of_cover TEXT NOT NULL,
    class_of_cover TEXT NOT NULL,
    industry TEXT,
    territory TEXT,
    original_insured_name TEXT,
    risk_description TEXT,

    currency TEXT NOT NULL DEFAULT 'USD',
    limit_of_liability NUMERIC(18,2) NOT NULL DEFAULT 0,
    deductible NUMERIC(18,2),
    retention NUMERIC(18,2),
    our_share NUMERIC(8,4) NOT NULL DEFAULT 100,

    gross_premium NUMERIC(18,2) NOT NULL DEFAULT 0,
    commission_percent NUMERIC(8,4),
    net_premium NUMERIC(18,2),
    minimum_premium NUMERIC(18,2),
    deposit_premium NUMERIC(18,2),
    adjustable_premium BOOLEAN DEFAULT FALSE,

    treaty_name TEXT,
    treaty_number TEXT,
    layer_number INTEGER,
    excess_point NUMERIC(18,2),

    aggregate_limit NUMERIC(18,2),
    aggregate_deductible NUMERIC(18,2),
    reinstatements INTEGER,
    reinstatement_premium NUMERIC(8,4),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,  -- No FK constraint (was profiles which doesn't exist)
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ir_origin ON public.inward_reinsurance(origin);
CREATE INDEX IF NOT EXISTS idx_ir_type ON public.inward_reinsurance(type);
CREATE INDEX IF NOT EXISTS idx_ir_structure ON public.inward_reinsurance(structure);
CREATE INDEX IF NOT EXISTS idx_ir_status ON public.inward_reinsurance(status);
CREATE INDEX IF NOT EXISTS idx_ir_deleted ON public.inward_reinsurance(is_deleted);
CREATE INDEX IF NOT EXISTS idx_ir_contract_number ON public.inward_reinsurance(contract_number);
CREATE INDEX IF NOT EXISTS idx_ir_cedant ON public.inward_reinsurance(cedant_name);
CREATE INDEX IF NOT EXISTS idx_ir_dates ON public.inward_reinsurance(inception_date, expiry_date);

ALTER TABLE public.inward_reinsurance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.inward_reinsurance;
CREATE POLICY "Enable read for authenticated users" ON public.inward_reinsurance FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.inward_reinsurance;
CREATE POLICY "Enable insert for authenticated users" ON public.inward_reinsurance FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.inward_reinsurance;
CREATE POLICY "Enable update for authenticated users" ON public.inward_reinsurance FOR UPDATE TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.inward_reinsurance;
CREATE POLICY "Enable delete for authenticated users" ON public.inward_reinsurance FOR DELETE TO authenticated USING (TRUE);

GRANT ALL ON public.inward_reinsurance TO authenticated;

-- ==============================================================================
-- 14. AGENDA TASKS TABLE (TEXT columns for user IDs - fixed version)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.agenda_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'PENDING',
    due_date TIMESTAMP WITH TIME ZONE,

    assigned_to TEXT,  -- TEXT not UUID (fixed)
    assigned_by TEXT,  -- TEXT not UUID (fixed)
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    entity_type TEXT,
    entity_id TEXT,

    policy_number TEXT,
    insured_name TEXT,
    broker_name TEXT,

    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT,  -- TEXT not UUID (fixed)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,  -- TEXT not UUID (fixed)
    updated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.agenda_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow All Access to Agenda" ON public.agenda_tasks;
CREATE POLICY "Allow All Access to Agenda" ON public.agenda_tasks FOR ALL USING (TRUE) WITH CHECK (TRUE);

GRANT ALL ON TABLE public.agenda_tasks TO anon, authenticated, service_role;

-- ==============================================================================
-- 15. ACTIVITY LOG TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,

    action TEXT,
    action_description TEXT,

    entity_type TEXT,
    entity_id TEXT,
    entity_reference TEXT,

    old_values JSONB,
    new_values JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View activity logs" ON public.activity_log;
CREATE POLICY "View activity logs" ON public.activity_log FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Insert activity logs" ON public.activity_log;
CREATE POLICY "Insert activity logs" ON public.activity_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT ON TABLE public.activity_log TO anon, authenticated;

-- ==============================================================================
-- 16. DEPARTMENTS TABLE (snake_case columns)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    head_of_department UUID REFERENCES auth.users(id),
    max_staff INTEGER DEFAULT 0,
    current_staff_count INTEGER DEFAULT 0,
    parent_department_id UUID REFERENCES public.departments(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View Departments" ON public.departments;
CREATE POLICY "View Departments" ON public.departments FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
DROP POLICY IF EXISTS "Manage Departments" ON public.departments;
CREATE POLICY "Manage Departments" ON public.departments FOR ALL USING (auth.role() = 'authenticated');

GRANT ALL ON TABLE public.departments TO postgres, service_role;
GRANT SELECT ON TABLE public.departments TO anon, authenticated;

-- ==============================================================================
-- FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Function: Get user role for claim permissions
CREATE OR REPLACE FUNCTION public.get_user_role_claim(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    u_role TEXT;
BEGIN
    SELECT role INTO u_role FROM public.users WHERE id = user_id;
    RETURN u_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check claim payment validity (prevent payments on informational claims)
CREATE OR REPLACE FUNCTION check_claim_payment_validity()
RETURNS TRIGGER AS $$
DECLARE
    c_type public.claim_liability_type;
BEGIN
    SELECT liability_type INTO c_type FROM public.claims WHERE id = NEW.claim_id;

    IF c_type = 'INFORMATIONAL' AND NEW.transaction_type IN ('PAYMENT', 'LEGAL_FEE', 'ADJUSTER_FEE') THEN
        RAISE EXCEPTION 'Cannot record Payments or Fees on an INFORMATIONAL claim. Convert to ACTIVE first.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_info_payments ON public.claim_transactions;
CREATE TRIGGER trg_block_info_payments
BEFORE INSERT ON public.claim_transactions
FOR EACH ROW EXECUTE FUNCTION check_claim_payment_validity();

-- Function: Handle new user signup (sync auth.users -> public.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, role, "avatarUrl", created_at, "isActive")
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'Viewer',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        "lastLogin" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function: Get agenda tasks with user names
CREATE OR REPLACE FUNCTION get_agenda_tasks(p_user_id UUID DEFAULT NULL, p_status TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    priority TEXT,
    status TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    assigned_to TEXT,
    assigned_to_name TEXT,
    assigned_by_name TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    entity_type TEXT,
    entity_id TEXT,
    policy_number TEXT,
    insured_name TEXT,
    broker_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    is_overdue BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.due_date,
        t.assigned_to,
        u_to.name as assigned_to_name,
        u_by.name as assigned_by_name,
        t.assigned_at,
        t.entity_type,
        t.entity_id,
        t.policy_number,
        t.insured_name,
        t.broker_name,
        t.created_at,
        CASE
            WHEN t.status != 'COMPLETED' AND t.due_date < NOW() THEN TRUE
            ELSE FALSE
        END as is_overdue
    FROM
        public.agenda_tasks t
    LEFT JOIN
        public.users u_to ON t.assigned_to::TEXT = u_to.id::TEXT
    LEFT JOIN
        public.users u_by ON t.assigned_by::TEXT = u_by.id::TEXT
    WHERE
        (p_user_id IS NULL OR t.assigned_to::TEXT = p_user_id::TEXT)
        AND
        (p_status IS NULL OR t.status = p_status)
    ORDER BY
        CASE t.priority
            WHEN 'URGENT' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            ELSE 4
        END ASC,
        t.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Delete user account (RPC)
CREATE OR REPLACE FUNCTION delete_user_account(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Security Check: Only Allow Admins/Super Admins
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('Super Admin', 'Admin')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Only Admins can delete users.';
    END IF;

    -- Prevent self-deletion
    IF user_id = auth.uid() THEN
        RAISE EXCEPTION 'Operation Failed: You cannot delete your own account.';
    END IF;

    DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- ==============================================================================
-- VIEWS
-- ==============================================================================

-- View: Active Loss Ratio
CREATE OR REPLACE VIEW view_active_loss_ratio AS
SELECT
    p.id as policy_id,
    p."policyNumber",
    p."grossPremium",
    COALESCE(SUM(ct.amount_our_share), 0) as total_incurred_our_share
FROM
    public.policies p
LEFT JOIN
    public.claims c ON p.id = c.policy_id AND c.liability_type = 'ACTIVE'
LEFT JOIN
    public.claim_transactions ct ON c.id = ct.claim_id
GROUP BY
    p.id, p."policyNumber", p."grossPremium";

-- View: Burning Cost Analysis
CREATE OR REPLACE VIEW view_burning_cost_analysis AS
SELECT
    p.id as policy_id,
    c.liability_type,
    COUNT(c.id) as claim_count,
    SUM(
        CASE
            WHEN c.liability_type = 'INFORMATIONAL' THEN c.imported_total_incurred
            ELSE (SELECT COALESCE(SUM(amount_100pct), 0) FROM public.claim_transactions WHERE claim_id = c.id)
        END
    ) as total_gross_incurred
FROM
    public.policies p
JOIN
    public.claims c ON p.id = c.policy_id
GROUP BY
    p.id, c.liability_type;

-- ==============================================================================
-- SEED DATA: Inward Reinsurance Presets
-- ==============================================================================
INSERT INTO public.inward_reinsurance_presets (category, value, description, sort_order) VALUES
    -- Type of Cover
    ('TYPE_OF_COVER', 'Property', 'Property insurance and reinsurance', 1),
    ('TYPE_OF_COVER', 'Casualty', 'Liability and casualty insurance', 2),
    ('TYPE_OF_COVER', 'Marine', 'Marine cargo and hull', 3),
    ('TYPE_OF_COVER', 'Aviation', 'Aviation risks', 4),
    ('TYPE_OF_COVER', 'Engineering', 'Construction and engineering risks', 5),
    ('TYPE_OF_COVER', 'Motor', 'Motor vehicle insurance', 6),
    ('TYPE_OF_COVER', 'Life', 'Life insurance and annuities', 7),
    ('TYPE_OF_COVER', 'Health', 'Health and medical insurance', 8),
    ('TYPE_OF_COVER', 'Specialty', 'Specialty and niche risks', 9),
    -- Class of Cover
    ('CLASS_OF_COVER', 'All Risks', 'Comprehensive all risks coverage', 1),
    ('CLASS_OF_COVER', 'Fire & Allied Perils', 'Fire, explosion, and allied perils', 2),
    ('CLASS_OF_COVER', 'Machinery Breakdown', 'Machinery and equipment breakdown', 3),
    ('CLASS_OF_COVER', 'Business Interruption', 'Loss of profit and BI coverage', 4),
    ('CLASS_OF_COVER', 'General Liability', 'Third party liability', 5),
    ('CLASS_OF_COVER', 'Professional Liability', 'E&O and professional indemnity', 6),
    ('CLASS_OF_COVER', 'Product Liability', 'Product liability coverage', 7),
    ('CLASS_OF_COVER', 'Cargo', 'Marine cargo coverage', 8),
    ('CLASS_OF_COVER', 'Hull', 'Marine hull coverage', 9),
    ('CLASS_OF_COVER', 'CAR/EAR', 'Contractors/Erection All Risks', 10),
    -- Industry
    ('INDUSTRY', 'Manufacturing', 'Manufacturing and industrial', 1),
    ('INDUSTRY', 'Oil & Gas', 'Petroleum and energy sector', 2),
    ('INDUSTRY', 'Construction', 'Construction and real estate development', 3),
    ('INDUSTRY', 'Retail', 'Retail and wholesale trade', 4),
    ('INDUSTRY', 'Transportation', 'Transport and logistics', 5),
    ('INDUSTRY', 'Financial Services', 'Banking and financial institutions', 6),
    ('INDUSTRY', 'Healthcare', 'Hospitals and healthcare providers', 7),
    ('INDUSTRY', 'Technology', 'IT and technology companies', 8),
    ('INDUSTRY', 'Agriculture', 'Farming and agribusiness', 9),
    ('INDUSTRY', 'Real Estate', 'Commercial and residential property', 10),
    ('INDUSTRY', 'Mining', 'Mining and extraction', 11),
    ('INDUSTRY', 'Telecommunications', 'Telecom and media', 12)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- VERIFICATION: Count rows in all tables
-- ==============================================================================
DO $$
DECLARE
    table_counts TEXT := '';
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MOSAIC ERP STAGING SCHEMA SETUP COMPLETE';
    RAISE NOTICE '========================================';
END $$;

SELECT 'users' as table_name, COUNT(*) as row_count FROM public.users
UNION ALL SELECT 'policies', COUNT(*) FROM public.policies
UNION ALL SELECT 'clauses', COUNT(*) FROM public.clauses
UNION ALL SELECT 'slips', COUNT(*) FROM public.slips
UNION ALL SELECT 'templates', COUNT(*) FROM public.templates
UNION ALL SELECT 'legal_entities', COUNT(*) FROM public.legal_entities
UNION ALL SELECT 'entity_logs', COUNT(*) FROM public.entity_logs
UNION ALL SELECT 'fx_rates', COUNT(*) FROM public.fx_rates
UNION ALL SELECT 'claims', COUNT(*) FROM public.claims
UNION ALL SELECT 'claim_transactions', COUNT(*) FROM public.claim_transactions
UNION ALL SELECT 'claim_documents', COUNT(*) FROM public.claim_documents
UNION ALL SELECT 'inward_reinsurance', COUNT(*) FROM public.inward_reinsurance
UNION ALL SELECT 'inward_reinsurance_presets', COUNT(*) FROM public.inward_reinsurance_presets
UNION ALL SELECT 'agenda_tasks', COUNT(*) FROM public.agenda_tasks
UNION ALL SELECT 'activity_log', COUNT(*) FROM public.activity_log
UNION ALL SELECT 'departments', COUNT(*) FROM public.departments
ORDER BY table_name;
