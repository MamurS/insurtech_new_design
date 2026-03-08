
-- ==============================================================================
-- CLAIMS MODULE MIGRATION
-- Adds Claims, Transactions, and Documents with strict Liability Logic
-- ==============================================================================

-- 1. ENUMS
CREATE TYPE public.claim_liability_type AS ENUM ('INFORMATIONAL', 'ACTIVE');
CREATE TYPE public.claim_status AS ENUM ('OPEN', 'CLOSED', 'REOPENED', 'DENIED');
CREATE TYPE public.claim_transaction_type AS ENUM ('RESERVE_SET', 'PAYMENT', 'RECOVERY', 'LEGAL_FEE', 'ADJUSTER_FEE');

-- 2. CLAIMS HEADER TABLE
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
    
    -- Classification
    claim_number TEXT NOT NULL, -- Internal or External Ref
    liability_type public.claim_liability_type NOT NULL DEFAULT 'INFORMATIONAL',
    status public.claim_status NOT NULL DEFAULT 'OPEN',
    
    -- Dates
    loss_date DATE, -- Approximate for Type 1, Exact for Type 2
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    closed_date DATE,
    
    -- Details
    description TEXT,
    claimant_name TEXT,
    location_country TEXT,
    
    -- TYPE 1 (Informational) DATA HOLDING
    -- These are used for "Burning Cost" analysis when no transaction ledger exists
    imported_total_incurred NUMERIC DEFAULT 0,
    imported_total_paid NUMERIC DEFAULT 0,
    
    -- Metadata
    legacy_id TEXT, -- For import mapping
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for frequent searching/reporting
CREATE INDEX idx_claims_policy ON public.claims(policy_id);
CREATE INDEX idx_claims_loss_date ON public.claims(loss_date);
CREATE INDEX idx_claims_type ON public.claims(liability_type);

-- 3. CLAIM TRANSACTIONS (The Ledger for Type 2)
CREATE TABLE IF NOT EXISTS public.claim_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    
    transaction_type public.claim_transaction_type NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Financials (100% Ground Up)
    amount_100pct NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate NUMERIC DEFAULT 1, -- Rate to System Base Currency
    
    -- Our Share (Snapshot at time of transaction for immutability)
    our_share_percentage NUMERIC NOT NULL, 
    amount_our_share NUMERIC GENERATED ALWAYS AS (amount_100pct * (our_share_percentage / 100)) STORED,
    
    payee TEXT, -- Who was paid?
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_claim_trans_claim ON public.claim_transactions(claim_id);

-- 4. CLAIM DOCUMENTS
CREATE TABLE IF NOT EXISTS public.claim_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase Storage Path
    file_type TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- BUSINESS LOGIC & CONSTRAINTS
-- ==============================================================================

-- Function to check role permissions
CREATE OR REPLACE FUNCTION public.get_user_role_claim(user_id UUID) 
RETURNS TEXT AS $$
DECLARE
    u_role TEXT;
BEGIN
    SELECT role INTO u_role FROM public.users WHERE id = user_id;
    RETURN u_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Prevent Payments on Informational Claims
CREATE OR REPLACE FUNCTION check_claim_payment_validity()
RETURNS TRIGGER AS $$
DECLARE
    c_type public.claim_liability_type;
BEGIN
    SELECT liability_type INTO c_type FROM public.claims WHERE id = NEW.claim_id;
    
    -- Rule: Cannot make payments on INFORMATIONAL claims
    IF c_type = 'INFORMATIONAL' AND NEW.transaction_type IN ('PAYMENT', 'LEGAL_FEE', 'ADJUSTER_FEE') THEN
        RAISE EXCEPTION 'Cannot record Payments or Fees on an INFORMATIONAL claim. Convert to ACTIVE first.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_info_payments
BEFORE INSERT ON public.claim_transactions
FOR EACH ROW
EXECUTE FUNCTION check_claim_payment_validity();

-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;

-- Read Access: Authenticated users can view claims linked to policies they can view
CREATE POLICY "View Claims" ON public.claims 
FOR SELECT USING (auth.role() = 'authenticated');

-- Write Access: Only specific roles can create
CREATE POLICY "Create Informational Claims" ON public.claims 
FOR INSERT WITH CHECK (
    public.get_user_role_claim(auth.uid()) IN ('Super Admin', 'Admin', 'Underwriter')
);

CREATE POLICY "Create Active Claims" ON public.claims 
FOR INSERT WITH CHECK (
    public.get_user_role_claim(auth.uid()) IN ('Super Admin', 'Admin', 'Underwriter') 
    AND liability_type = 'ACTIVE'
);

-- Transactions: Only Claims Handlers/Admins can pay
CREATE POLICY "Manage Transactions" ON public.claim_transactions
FOR ALL USING (
    public.get_user_role_claim(auth.uid()) IN ('Super Admin', 'Admin', 'Underwriter')
);


-- ==============================================================================
-- REPORTING VIEWS (Sample Queries)
-- ==============================================================================

-- A. Loss Ratio View (Active Claims Only)
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

-- B. Burning Cost View (Combines Type 1 & Type 2)
CREATE OR REPLACE VIEW view_burning_cost_analysis AS
SELECT 
    p.id as policy_id,
    c.liability_type,
    COUNT(c.id) as claim_count,
    -- For Type 1: Use imported column. For Type 2: Sum transactions
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

