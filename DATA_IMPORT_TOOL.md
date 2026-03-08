# Data Import Tool

Comprehensive production import tool with full rollback capability.

## Summary

### Files Created in `/production/`

| File | Purpose |
|------|---------|
| `import_production.py` | Main import script with all functionality |
| `.env.template` | Template for your credentials |
| `add_import_tracking_columns.sql` | One-time migration (run before first import) |
| `README.md` | Detailed usage instructions |

### Checkpoint/Rollback Strategy

**Three rollback options:**

1. **Rollback by Batch ID** - Delete only records from a specific import:
   ```bash
   python import_production.py --rollback abc123
   ```

2. **Full Restore** - Restore entire database to pre-import state:
   ```bash
   python import_production.py --restore backup_20260210_143000
   ```

3. **Manual Backup** - Create backup anytime:
   ```bash
   python import_production.py --backup
   ```

### To Run the Production Import

On your local Mac:

1. **Copy files to your Mac** (where the Excel file is):
   ```bash
   # Copy the production folder from the repo
   ```

2. **Set up environment**:
   ```bash
   cd production
   cp .env.template .env
   # Edit .env with production Supabase credentials
   ```

3. **Run migration ONCE** (in Supabase SQL Editor):
   ```sql
   -- Run add_import_tracking_columns.sql
   ```

4. **Preview first** (dry run):
   ```bash
   python import_production.py --dry-run
   ```

5. **Execute import**:
   ```bash
   python import_production.py --import
   ```

### What Gets Imported

- **All sheets** from Excel (each year as separate sheet)
- **Legal entities** extracted automatically:
  - Cedants → Insurance Company/Reinsurer
  - Brokers → Broker
  - Original Insureds → Insured
- **Deduplication**: Won't create duplicate entities

### For Previous Years

Each import gets its own batch ID:
```bash
EXCEL_FILE=Portfolio_2023.xlsb python import_production.py --import
EXCEL_FILE=Portfolio_2022.xlsb python import_production.py --import
```

Each can be independently rolled back if needed.

---

## Step-by-Step Production Import

### Step 1: Install Python Dependencies
```bash
pip install supabase pyxlsb msoffcrypto-tool python-dotenv
```

### Step 2: Copy Files to Your Mac
Copy the `/production/` folder from the repo to the same directory where your Excel file is located.

### Step 3: Create Your .env File
```bash
cd production
cp .env.template .env
```

Edit `.env` with your production credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
EXCEL_FILE=/path/to/your/Reinsurance_Portfolio.xlsb
EXCEL_PASSWORD=your-excel-password
```

**Note:** Use the **service role key** (not the anon key) - find it in Supabase Dashboard → Settings → API → service_role

### Step 4: Run Migration in Supabase
Go to Supabase Dashboard → SQL Editor → New Query, paste the contents of `add_import_tracking_columns.sql` and run it:
```sql
ALTER TABLE inward_reinsurance
ADD COLUMN IF NOT EXISTS import_batch_id TEXT,
ADD COLUMN IF NOT EXISTS import_source TEXT;

ALTER TABLE legal_entities
ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_inward_reinsurance_import_batch
ON inward_reinsurance(import_batch_id)
WHERE import_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_entities_import_batch
ON legal_entities(import_batch_id)
WHERE import_batch_id IS NOT NULL;
```

### Step 5: Preview Import (Dry Run)
```bash
python import_production.py --dry-run
```
Review the output and check `./previews/` folder for sample data.

### Step 6: Execute Import
```bash
python import_production.py --import
```

The script will:
1. Create a backup automatically
2. Ask for confirmation
3. Import legal entities
4. Import all reinsurance records
5. Give you a batch ID for rollback if needed

---

**If anything goes wrong**, you can rollback:
```bash
python import_production.py --rollback BATCH_ID
# or
python import_production.py --restore backup_YYYYMMDD_HHMMSS
```
