
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (Profile data linked to Auth)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  name text,
  role text default 'Viewer',
  "avatarUrl" text,
  permissions jsonb,
  "lastLogin" timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.users enable row level security;

-- Policies for Users
create policy "Public profiles are viewable by everyone" on public.users for select using (true);
create policy "Users can insert their own profile" on public.users for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- 2. Policies Table
create table public.policies (
  id uuid default uuid_generate_v4() primary key,
  
  -- Core Architecture (New)
  "channel" text, -- Direct / Inward
  "intermediaryType" text, -- Broker / Agent / Direct
  "intermediaryName" text, -- Name of the intermediary
  
  -- Legacy Architecture (Backwards Compat)
  "recordType" text, 
  "brokerName" text,

  -- Identifiers
  "policyNumber" text,
  "secondaryPolicyNumber" text,
  "slipNumber" text,
  "agreementNumber" text,
  "bordereauNo" text,
  "invoiceIssued" boolean,
  "coverNote" text,
  
  -- Dates
  "dateOfSlip" date,
  "accountingDate" date,
  "inceptionDate" date,
  "expiryDate" date,
  "issueDate" date,
  "reinsuranceInceptionDate" date,
  "reinsuranceExpiryDate" date,
  "paymentDate" date,
  "warrantyPeriod" integer,
  "activationDate" timestamp with time zone,

  -- Parties
  "insuredName" text,
  "insuredAddress" text,
  "borrower" text,
  "cedantName" text,
  "retrocedent" text,
  "reinsurerName" text,
  "performer" text,
  
  -- Risk Details
  industry text,
  territory text,
  city text,
  jurisdiction text,
  "classOfInsurance" text,
  "typeOfInsurance" text,
  "riskCode" text,
  "insuredRisk" text,
  
  -- Financials (Base)
  currency text,
  "sumInsured" numeric,
  "grossPremium" numeric,
  "exchangeRate" numeric,
  "equivalentUSD" numeric,

  -- Financials (Extended / National Currency)
  "sumInsuredNational" numeric,
  "premiumNationalCurrency" numeric,
  
  -- Limits & Excess
  "limitForeignCurrency" numeric,
  "limitNationalCurrency" numeric,
  "excessForeignCurrency" numeric,
  "prioritySum" numeric,
  
  "premiumRate" numeric,

  -- Our Share / Net
  "ourShare" numeric,
  "netPremium" numeric,
  "commissionPercent" numeric,
  "taxPercent" numeric,
  deductible text,
  conditions text,

  -- Outward Reinsurance
  "hasOutwardReinsurance" boolean default false,
  "reinsurers" jsonb default '[]'::jsonb, -- Stores array of reinsurers
  "reinsuranceCommission" numeric,
  "netReinsurancePremium" numeric,
  "cededShare" numeric,
  
  "cededPremiumForeign" numeric,
  "cededPremiumNational" numeric,

  "sumReinsuredForeign" numeric,
  "sumReinsuredNational" numeric,
  
  "receivedPremiumForeign" numeric,
  "receivedPremiumNational" numeric,
  
  "numberOfSlips" integer,

  -- Treaty / Inward Specifics
  "treatyPlacement" text,
  "treatyPremium" numeric,
  "aicCommission" numeric,
  "aicRetention" numeric,
  "aicPremium" numeric,
  "maxRetentionPerRisk" numeric,
  "reinsurerRating" text,

  -- Status & Tracking
  status text,
  "paymentStatus" text,
  installments jsonb default '[]'::jsonb,
  claims jsonb default '[]'::jsonb,
  "selectedClauseIds" text[] default '{}',
  "isDeleted" boolean default false,

  "signedDocument" jsonb,
  "terminationDetails" jsonb,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.policies enable row level security;
create policy "Enable all access for authenticated users" on public.policies for all using (auth.role() = 'authenticated');


-- 3. Clauses Table
create table public.clauses (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  content text,
  "isStandard" boolean default false,
  category text,
  "isDeleted" boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.clauses enable row level security;
create policy "Enable all access for authenticated users" on public.clauses for all using (auth.role() = 'authenticated');


-- 4. Reinsurance Slips Table
create table public.slips (
  id uuid default uuid_generate_v4() primary key,
  "slipNumber" text not null,
  date date,
  "insuredName" text,
  "brokerReinsurer" text,
  "reinsurers" jsonb default '[]'::jsonb, -- Array of markets
  "limitOfLiability" numeric,
  currency text,
  "isDeleted" boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.slips enable row level security;
create policy "Enable all access for authenticated users" on public.slips for all using (auth.role() = 'authenticated');


-- 5. Templates Table
create table public.templates (
  id text primary key, 
  name text,
  description text,
  content text,
  "isDeleted" boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.templates enable row level security;
create policy "Enable all access for authenticated users" on public.templates for all using (auth.role() = 'authenticated');


-- 6. Legal Entities Table
create table public.legal_entities (
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

alter table public.legal_entities enable row level security;
create policy "Enable all access for authenticated users" on public.legal_entities for all using (auth.role() = 'authenticated');


-- 7. Entity Logs (Audit Trail for Legal Entities)
create table public.entity_logs (
  id uuid default uuid_generate_v4() primary key,
  "entityId" text, 
  "userId" text,
  "userName" text,
  action text,
  changes text, -- JSON string
  timestamp timestamp with time zone
);

alter table public.entity_logs enable row level security;
create policy "Enable all access for authenticated users" on public.entity_logs for all using (auth.role() = 'authenticated');


-- 8. FX Rates Table
create table public.fx_rates (
  id uuid default uuid_generate_v4() primary key,
  currency text,
  rate numeric,
  date date
);

alter table public.fx_rates enable row level security;
create policy "Enable all access for authenticated users" on public.fx_rates for all using (auth.role() = 'authenticated');
