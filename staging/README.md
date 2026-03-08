# Mosaic ERP Staging Database Setup

Complete guide for setting up a staging Supabase project with imported portfolio data.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GITHUB CODESPACES (development & testing)                                   │
│  ├── Run Python import script here                                           │
│  ├── Run npm run dev here (port forwarded)                                   │
│  └── Upload Excel files here                                                 │
│                                                                              │
│  SUPABASE (databases)                                                        │
│  ├── Production: onppnfyoffhyaxemsqoz                                        │
│  └── Staging: mosaic-erp-staging (new)                                       │
│                                                                              │
│  RENDER (production deployment)                                              │
│  └── Auto-deploys from GitHub main branch                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- A GitHub Codespace (or any cloud development environment)
- A Supabase account
- Excel portfolio file (.xlsb) to import

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it `mosaic-erp-staging` (or similar)
3. Choose a region close to you
4. Set a strong database password (save it somewhere safe)
5. Wait for the project to finish provisioning (~2 minutes)

## Step 2: Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `mosaic_staging_schema.sql` from this folder
3. Copy the entire contents and paste into the SQL Editor
4. Click **Run** (or Cmd/Ctrl + Enter)
5. Wait for the schema to be created
6. You should see a verification table at the bottom showing all tables with 0 rows (except `inward_reinsurance_presets` which has seed data)

## Step 3: Create Test User

1. Go to **Authentication → Users**
2. Click **Add User** → **Create new user**
3. Enter an email and password
4. Click **Create User**
5. Go to **Table Editor → users**
6. Find your user and update the `role` column to `Super Admin`

## Step 4: Get API Credentials

1. Go to **Project Settings → API**
2. Copy these values:
   - **Project URL** (e.g., `https://abcdef.supabase.co`)
   - **service_role key** (for the import script - the secret one)
   - **anon key** (for the React app - the public one)

## Step 5: Upload Excel File to Codespace

If you're working in a GitHub Codespace:

**Option A: Drag and Drop**
1. Open the file explorer in VS Code (Codespace)
2. Navigate to the `staging/` folder
3. Drag your `.xlsb` file from your computer into the folder

**Option B: Using GitHub CLI**
```bash
# From your local machine, copy file to Codespace
gh codespace cp ./Reinsurance_Portfolio.xlsb remote:/workspaces/InsurTech/staging/
```

**Option C: Download from cloud storage**
```bash
# If file is hosted somewhere accessible
curl -o staging/Reinsurance_Portfolio.xlsb "https://your-file-url"
```

## Step 6: Configure Import Script

```bash
cd staging

# Create .env from template
cp .env.template .env

# Edit .env with your values (use the built-in editor)
```

Fill in your `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...
EXCEL_FILE=Reinsurance_Portfolio.xlsb
EXCEL_PASSWORD=
DRY_RUN=true
```

## Step 7: Install Python Dependencies

```bash
pip install supabase pyxlsb msoffcrypto-tool python-dotenv
```

## Step 8: Dry Run Import

```bash
python import_portfolio.py
```

This will:
1. Decrypt the Excel file (if encrypted)
2. Parse all rows
3. Write first 20 records to `import_preview.json`
4. Exit without inserting anything

Review `import_preview.json` to verify the data looks correct.

## Step 9: Real Import

```bash
# Edit .env and set:
# DRY_RUN=false

python import_portfolio.py
```

The script will:
1. Insert records in batches of 50
2. Retry failed batches row-by-row
3. Print a summary of inserted/failed records

## Step 10: Run the React App

The app has a built-in **Environment Switcher** that lets you switch between Production and Staging databases without editing `.env` files.

### Configure Environment Variables

In the **root** `.env` file, add your staging credentials:

```env
# Production (existing)
SUPABASE_URL=https://onppnfyoffhyaxemsqoz.supabase.co
SUPABASE_KEY=production-anon-key

# Staging (new - enables the in-app switcher)
SUPABASE_STAGING_URL=https://your-staging-project.supabase.co
SUPABASE_STAGING_KEY=staging-anon-key
```

### Run Development Server

```bash
# From project root
npm install
npm run dev
```

The Codespace will automatically forward the port. Look for the popup or check the **Ports** tab to get the URL.

### Switch Environments

1. On the **Login page**, you'll see an environment switcher in the top-right corner
2. Select "Staging" to connect to the staging database
3. The page will reload with the new connection
4. A yellow banner at the top confirms you're on staging

## Step 11: Verify Data

1. Log in with your test user credentials
2. Go to **Inward Reinsurance → Foreign** or **Domestic**
3. You should see the imported records
4. Go to **Analytics Dashboard** to see KPI summaries

---

## Environment Switcher

The app includes an in-app environment switcher:

- **Login Page**: Visible to everyone (top-right corner)
- **Settings Page**: Visible to Super Admin and Admin only
- **Staging Banner**: Yellow warning bar shown when connected to staging

When connected to staging:
- A persistent yellow banner shows: "⚠️ STAGING ENVIRONMENT"
- The switcher shows an amber dot instead of green

---

## Known Issues

### Analytics Shows No Data

The `hooks/useAnalytics.ts` file queries snake_case column names (`gross_premium_original`, `is_deleted`) but the `policies` table uses camelCase (`"grossPremium"`, `"isDeleted"`).

**Quick Fix:** Edit `hooks/useAnalytics.ts` and change:
```typescript
// FROM:
.select('gross_premium_original, net_premium_original, status')
.eq('is_deleted', false);

// TO:
.select('"grossPremium", "netPremium", status')
.eq('"isDeleted"', false);
```

Note the double-quotes around camelCase column names (required by PostgreSQL).

---

## Column Naming Convention Reference

The database has **two naming conventions** that must be preserved:

| Tables (camelCase in quotes) | Tables (snake_case) |
|------------------------------|---------------------|
| `users` | `inward_reinsurance` |
| `policies` | `inward_reinsurance_presets` |
| `clauses` | `claims` |
| `slips` | `claim_transactions` |
| `templates` | `claim_documents` |
| `legal_entities` | `agenda_tasks` |
| `entity_logs` | `activity_log` |
| | `departments` |
| | `fx_rates` |

**camelCase example:** `SELECT "grossPremium", "insuredName", "isDeleted" FROM policies`

**snake_case example:** `SELECT gross_premium, cedant_name, is_deleted FROM inward_reinsurance`

---

## Multi-Sheet Import (NEW)

The `import_all_sheets.py` script can import ALL 4 sheets from the Excel file:

| Sheet Name | Target Table | Row Count |
|------------|--------------|-----------|
| Insurance Contracts | `policies` | ~301 rows |
| Outward | `policies` (as outward RI) | ~2848 rows |
| Outward RE Slıp № | `slips` | ~901 rows |
| Inward | `inward_reinsurance` | Already imported |

### Usage

```bash
# Preview all sheets (no changes)
python import_all_sheets.py --dry-run

# Import specific sheet
python import_all_sheets.py --sheet contracts    # Insurance Contracts → policies
python import_all_sheets.py --sheet outward      # Outward → policies
python import_all_sheets.py --sheet slips        # Slips → slips

# Import all sheets (except inward)
python import_all_sheets.py --all
```

### Column Mappings

**Sheet 1: Insurance Contracts → policies**

| Excel Col | policies Column |
|-----------|-----------------|
| A | accountingCode |
| B | policyNumber |
| C | insuredName |
| D | brokerName |
| E | classOfInsurance |
| F | typeOfInsurance |
| G | insuredRisk |
| H | territory |
| I | city |
| J | currency |
| K-V | (financial columns) |
| W | paymentDate |
| X-Y | exchangeRateUSD, equivalentUSD |

**Sheet 2: Outward → policies (with recordType='OUTWARD')**

| Excel Col | policies Column |
|-----------|-----------------|
| A-D | accountingCode, policyNumber, secondaryPolicyNumber, slipNumber |
| E-G | insuredName, reinsurerName, brokerName |
| H-L | classOfInsurance, typeOfInsurance, insuredRisk, territory, currency |
| M-R | sumInsured, limits, cededShare, sumReinsured |
| S-T | reinsuranceInceptionDate, reinsuranceExpiryDate |
| U-AD | reinsuranceDays, premiums, commissions |

**Sheet 3: Slips → slips**

| Excel Col | slips Column |
|-----------|--------------|
| A | slipNumber |
| B | date |
| C | insuredName |
| D | brokerReinsurer |
| E | limitOfLiability |
| G | currency |

---

## Claims Import (NEW)

The `import_claims.py` script imports claims from `INWARD_CLAIMS_PORTFOLIO.xls` (375 rows).

### Prerequisites

1. Install xlrd for .xls files:
   ```bash
   pip install xlrd msoffcrypto-tool supabase python-dotenv
   ```

2. **Run this SQL in Supabase SQL Editor FIRST:**
   ```sql
   ALTER TABLE public.claims ALTER COLUMN policy_id DROP NOT NULL;
   ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS inward_reinsurance_id UUID REFERENCES public.inward_reinsurance(id);
   ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS source_type TEXT;
   ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS slip_number TEXT;
   ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS contract_number TEXT;
   ```

   Or run: `claims_table_migration.sql`

### Usage

```bash
# Preview mode (no database changes)
python import_claims.py --dry-run

# Real import
python import_claims.py
```

### Claim Types

| Source Type | Count | Links To |
|-------------|-------|----------|
| Foreign inward | 347 | inward_reinsurance |
| Local outward | 14 | policies (outward) |
| Local inward | 7 | inward_reinsurance |
| Direct | 5 | policies (direct) |
| Domestic inward | 2 | inward_reinsurance |

### Matching Logic

- **Inward claims** → matched by slip number to `inward_reinsurance.contract_number`
- **Direct claims** → matched by policy number to `policies.policyNumber`
- **Outward claims** → matched by slip number to `policies.slipNumber`
- Unmatched claims are still imported with `slip_number` and `contract_number` for manual linking

---

## File Structure

```
staging/
├── mosaic_staging_schema.sql   # Complete DB schema (run in SQL Editor)
├── claims_table_migration.sql  # Claims table modifications for import
├── import_portfolio.py         # Original import script (Inward only)
├── import_all_sheets.py        # Multi-sheet importer (4 sheets)
├── import_claims.py            # Claims importer
├── .env.template               # Environment template
├── .env                        # Your local config (git-ignored)
├── import_preview.json         # Generated by dry run
├── claims_preview.json         # Claims preview from dry run
├── preview_*.json              # Sheet-specific previews
└── README.md                   # This file
```

---

## Troubleshooting

### "relation does not exist"
Run the schema SQL again - some tables may have failed to create.

### "permission denied for table"
Make sure you're using the **service_role** key for the import script (bypasses RLS).

### "duplicate key value violates unique constraint"
The data was already imported. Truncate the table first:
```sql
TRUNCATE TABLE inward_reinsurance CASCADE;
```

### Import script can't read .xlsb file
Make sure you have `pyxlsb` and `msoffcrypto-tool` installed:
```bash
pip install pyxlsb msoffcrypto-tool
```

### Dates look wrong
The script handles Excel serial numbers and various date formats. Check `import_preview.json` to see how dates are being parsed.

### Port not accessible in Codespace
Check the **Ports** tab in VS Code and make sure port 5173 is set to "Public" visibility.

---

## Render Deployment

To enable the environment switcher in the Render deployment, add these environment variables in the Render dashboard (Settings → Environment):

```
SUPABASE_URL=https://onppnfyoffhyaxemsqoz.supabase.co
SUPABASE_KEY=production-anon-key
SUPABASE_STAGING_URL=https://staging-project.supabase.co
SUPABASE_STAGING_KEY=staging-anon-key
```

This allows the deployed app on Render to also switch between environments.
