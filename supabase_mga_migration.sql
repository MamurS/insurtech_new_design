-- =============================================
-- MGA / Binding Authority Module - Phase 1
-- Tables: binding_agreements, bordereaux_entries
-- =============================================

-- Table: binding_agreements
CREATE TABLE IF NOT EXISTS binding_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_number TEXT UNIQUE NOT NULL,
  agreement_type TEXT NOT NULL DEFAULT 'BINDING_AUTHORITY',
  mga_name TEXT NOT NULL,
  mga_entity_id UUID REFERENCES legal_entities(id),
  broker_name TEXT,
  broker_entity_id UUID REFERENCES legal_entities(id),
  underwriter TEXT,
  status TEXT DEFAULT 'DRAFT',
  inception_date DATE,
  expiry_date DATE,
  currency TEXT DEFAULT 'USD',
  territory_scope TEXT,
  class_of_business TEXT,
  epi NUMERIC DEFAULT 0,
  our_share NUMERIC DEFAULT 1.0,
  commission_percent NUMERIC DEFAULT 0,
  max_limit_per_risk NUMERIC,
  aggregate_limit NUMERIC,
  deposit_premium NUMERIC DEFAULT 0,
  minimum_premium NUMERIC DEFAULT 0,
  claims_authority_limit NUMERIC DEFAULT 0,
  risk_parameters JSONB,
  notes TEXT,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Table: bordereaux_entries
CREATE TABLE IF NOT EXISTS bordereaux_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES binding_agreements(id),
  bordereaux_type TEXT DEFAULT 'PREMIUM',
  period_from DATE,
  period_to DATE,
  submission_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'PENDING',
  total_gwp NUMERIC DEFAULT 0,
  total_policies INTEGER DEFAULT 0,
  total_claims_paid NUMERIC DEFAULT 0,
  total_claims_reserved NUMERIC DEFAULT 0,
  file_name TEXT,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ba_status ON binding_agreements(status);
CREATE INDEX idx_ba_mga ON binding_agreements(mga_name);
CREATE INDEX idx_bdx_agreement ON bordereaux_entries(agreement_id);
CREATE INDEX idx_bdx_status ON bordereaux_entries(status);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON binding_agreements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bordereaux_entries TO anon, authenticated;
