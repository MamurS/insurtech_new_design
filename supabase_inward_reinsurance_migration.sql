-- Inward Reinsurance Module Migration
-- Run this in Supabase SQL Editor to set up the inward reinsurance tables

-- =============================================
-- 1. Create inward_reinsurance_presets table
-- =============================================
CREATE TABLE IF NOT EXISTS inward_reinsurance_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('TYPE_OF_COVER', 'CLASS_OF_COVER', 'INDUSTRY')),
    value TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_presets_category ON inward_reinsurance_presets(category);
CREATE INDEX IF NOT EXISTS idx_presets_active ON inward_reinsurance_presets(is_active);

-- =============================================
-- 2. Create inward_reinsurance table
-- =============================================
CREATE TABLE IF NOT EXISTS inward_reinsurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number TEXT NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('FOREIGN', 'DOMESTIC')),
    type TEXT NOT NULL CHECK (type IN ('FAC', 'TREATY')),
    structure TEXT NOT NULL CHECK (structure IN ('PROPORTIONAL', 'NON_PROPORTIONAL')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),

    -- Cedant/Source Info
    cedant_name TEXT NOT NULL,
    cedant_entity_id UUID REFERENCES legal_entities(id),
    cedant_country TEXT,
    broker_name TEXT,
    broker_entity_id UUID REFERENCES legal_entities(id),

    -- Contract Period
    inception_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    uw_year INTEGER,

    -- Coverage Details
    type_of_cover TEXT NOT NULL,
    class_of_cover TEXT NOT NULL,
    industry TEXT,
    territory TEXT,
    original_insured_name TEXT,
    risk_description TEXT,

    -- Financial Terms
    currency TEXT NOT NULL DEFAULT 'USD',
    limit_of_liability NUMERIC(18,2) NOT NULL DEFAULT 0,
    deductible NUMERIC(18,2),
    retention NUMERIC(18,2),
    our_share NUMERIC(8,4) NOT NULL DEFAULT 100,

    -- Premium
    gross_premium NUMERIC(18,2) NOT NULL DEFAULT 0,
    commission_percent NUMERIC(8,4),
    net_premium NUMERIC(18,2),
    minimum_premium NUMERIC(18,2),
    deposit_premium NUMERIC(18,2),
    adjustable_premium BOOLEAN DEFAULT false,

    -- Treaty-specific
    treaty_name TEXT,
    treaty_number TEXT,
    layer_number INTEGER,
    excess_point NUMERIC(18,2),

    -- Non-Proportional specific
    aggregate_limit NUMERIC(18,2),
    aggregate_deductible NUMERIC(18,2),
    reinstatements INTEGER,
    reinstatement_premium NUMERIC(8,4),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    is_deleted BOOLEAN DEFAULT false
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ir_origin ON inward_reinsurance(origin);
CREATE INDEX IF NOT EXISTS idx_ir_type ON inward_reinsurance(type);
CREATE INDEX IF NOT EXISTS idx_ir_structure ON inward_reinsurance(structure);
CREATE INDEX IF NOT EXISTS idx_ir_status ON inward_reinsurance(status);
CREATE INDEX IF NOT EXISTS idx_ir_deleted ON inward_reinsurance(is_deleted);
CREATE INDEX IF NOT EXISTS idx_ir_contract_number ON inward_reinsurance(contract_number);
CREATE INDEX IF NOT EXISTS idx_ir_cedant ON inward_reinsurance(cedant_name);
CREATE INDEX IF NOT EXISTS idx_ir_dates ON inward_reinsurance(inception_date, expiry_date);

-- =============================================
-- 3. Enable Row Level Security
-- =============================================
ALTER TABLE inward_reinsurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE inward_reinsurance_presets ENABLE ROW LEVEL SECURITY;

-- Policies for inward_reinsurance
CREATE POLICY "Enable read for authenticated users" ON inward_reinsurance
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON inward_reinsurance
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON inward_reinsurance
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON inward_reinsurance
    FOR DELETE TO authenticated USING (true);

-- Policies for inward_reinsurance_presets
CREATE POLICY "Enable read for authenticated users" ON inward_reinsurance_presets
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON inward_reinsurance_presets
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON inward_reinsurance_presets
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON inward_reinsurance_presets
    FOR DELETE TO authenticated USING (true);

-- =============================================
-- 4. Seed initial presets
-- =============================================
INSERT INTO inward_reinsurance_presets (category, value, description, sort_order) VALUES
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

-- =============================================
-- 5. Grant permissions
-- =============================================
GRANT ALL ON inward_reinsurance TO authenticated;
GRANT ALL ON inward_reinsurance_presets TO authenticated;
