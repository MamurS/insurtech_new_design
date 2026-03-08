# Staging Database - Multi-Sheet Import

Import all 4 Excel sheets into the staging Supabase database.

## Overview

The `staging/import_all_sheets.py` script imports data from the Excel portfolio file into the staging database.

| Sheet | Target Table | Status |
|-------|--------------|--------|
| Insurance Contracts | `policies` | Ready to import |
| Outward | `policies` | Ready to import |
| Outward RE Slıp № | `slips` | Ready to import |
| Inward | `inward_reinsurance` | Skip (already imported) |

## Prerequisites

```bash
pip install supabase pyxlsb msoffcrypto-tool python-dotenv
```

## Setup

1. Navigate to the staging directory:
   ```bash
   cd staging
   ```

2. Create `.env` from template (if not already done):
   ```bash
   cp .env.template .env
   ```

3. Edit `.env` with your credentials:
   ```
   SUPABASE_URL=https://jwauzanxuwmwvvkojwmx.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   EXCEL_FILE=Reinsurance_Portfolio_-2021-2026.xlsb
   EXCEL_PASSWORD=0110
   ```

4. Place the Excel file in the `staging/` directory

## Usage

### Step 1: Preview All Sheets (Dry Run)

```bash
python import_all_sheets.py --dry-run
```

This creates preview JSON files without modifying the database:
- `preview_insurance_contracts.json`
- `preview_outward.json`
- `preview_outward_re_slip.json`
- `preview_inward.json`

### Step 2: Import Specific Sheet

```bash
python import_all_sheets.py --sheet contracts    # Insurance Contracts → policies
python import_all_sheets.py --sheet outward      # Outward → policies
python import_all_sheets.py --sheet slips        # Slips → slips
python import_all_sheets.py --sheet inward       # Inward → inward_reinsurance (if needed)
```

### Step 3: Import All Sheets

```bash
python import_all_sheets.py --all
```

This imports all sheets except Inward (which was already imported).

## Column Mappings

### Sheet 1: Insurance Contracts → policies

| Excel Column | Database Column |
|--------------|-----------------|
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
| K | sumInsured |
| L | sumInsuredNational |
| M | premiumRate |
| N | insuranceDays |
| O | inceptionDate |
| P | expiryDate |
| Q | grossPremium |
| R | grossPremiumNational |
| S | commissionPercent |
| T | commissionNational |
| U | netPremium |
| V | netPremiumNational |
| W | paymentDate |
| X | exchangeRateUSD |
| Y | equivalentUSD |
| AC | referenceLink |
| AD | conditions |

### Sheet 2: Outward → policies

| Excel Column | Database Column |
|--------------|-----------------|
| A | accountingCode |
| B | policyNumber |
| C | secondaryPolicyNumber |
| D | slipNumber |
| E | insuredName |
| F | reinsurerName |
| G | brokerName |
| H | classOfInsurance |
| I | typeOfInsurance |
| J | insuredRisk |
| K | territory |
| L | currency |
| M | sumInsured |
| N | limitForeignCurrency |
| O | limitNationalCurrency |
| P | cededShare |
| Q | sumReinsuredForeign |
| R | sumReinsuredNational |
| S | reinsuranceInceptionDate |
| T | reinsuranceExpiryDate |
| U | reinsuranceDays |
| V | grossPremium |
| W | cededPremiumForeign |
| X | cededPremiumNational |
| Y | reinsuranceCommission |
| Z | netReinsurancePremium |
| AA | receivedPremiumForeign |
| AB | receivedPremiumNational |
| AC | exchangeRateUSD |
| AD | equivalentUSD |
| AG | reinsuranceType |

### Sheet 3: Outward RE Slips → slips

| Excel Column | Database Column |
|--------------|-----------------|
| A | slipNumber |
| B | date |
| C | insuredName |
| D | brokerReinsurer |
| E | limitOfLiability |
| G | currency |

### Sheet 4: Inward → inward_reinsurance

Already imported. See `staging/import_portfolio.py` for column mappings.

## Files

| File | Purpose |
|------|---------|
| `staging/import_all_sheets.py` | Multi-sheet importer |
| `staging/import_portfolio.py` | Original Inward-only importer |
| `staging/.env.template` | Environment template |
| `staging/.env` | Your credentials (git-ignored) |
| `staging/mosaic_staging_schema.sql` | Database schema |
| `staging/README.md` | Full staging documentation |

## Troubleshooting

### "Module not found" error
```bash
pip install supabase pyxlsb msoffcrypto-tool python-dotenv
```

### "File not found" error
Ensure the Excel file is in the `staging/` directory and the filename in `.env` matches exactly.

### Permission/RLS errors
Use the `service_role` key (not `anon` key) - it bypasses Row Level Security.

### Batch insert failures
The script automatically retries failed batches row-by-row. Check error messages for specific issues.
