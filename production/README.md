# Production Database Import

Comprehensive import tool for production database with rollback capability.

## Prerequisites

```bash
pip install supabase pyxlsb msoffcrypto-tool python-dotenv
```

## Setup

1. Copy `.env.template` to `.env`:
   ```bash
   cp .env.template .env
   ```

2. Edit `.env` with your production Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   EXCEL_FILE=/path/to/Reinsurance_Portfolio.xlsb
   EXCEL_PASSWORD=your-password
   ```

3. Run the migration to add tracking columns (ONCE, before first import):
   ```sql
   -- Run add_import_tracking_columns.sql in Supabase SQL Editor
   ```

## Usage

### Step 1: Preview Import (Dry Run)
```bash
python import_production.py --dry-run
```
This will:
- Parse all sheets from the Excel file
- Extract legal entities
- Save preview files to `./previews/` directory
- Make NO changes to the database

Review the preview files before proceeding.

### Step 2: Execute Import
```bash
python import_production.py --import
```
This will:
1. Create a backup of current database state
2. Ask for confirmation
3. Import legal entities (deduplicated)
4. Import all inward reinsurance records
5. Assign a batch ID for tracking

## Rollback Options

### Option 1: Rollback by Batch ID
If something goes wrong with a specific import:
```bash
python import_production.py --rollback BATCH_ID
```
This deletes only the records from that specific import batch.

### Option 2: Full Restore from Backup
If you need to restore to the exact pre-import state:
```bash
# List available backups
python import_production.py --list-backups

# Restore from a specific backup
python import_production.py --restore backup_20260210_143000
```

### Option 3: Manual Backup Only
Create a backup without importing:
```bash
python import_production.py --backup
```

## What Gets Imported

### From Excel Sheets
- All sheets are processed (unless named 'template', 'summary', etc.)
- Each sheet typically represents a different year
- Records are inserted into `inward_reinsurance` table

### Legal Entities
Unique entities are extracted from:
- `cedant_name` → Type: Insurance Company/Reinsurer
- `broker_name` → Type: Broker
- `original_insured_name` → Type: Insured

Existing entities (by name) are NOT duplicated.

## Tracking Fields

Each imported record includes:
- `import_batch_id`: Short ID for the import batch (e.g., "a1b2c3d4")
- `import_source`: Where the record came from (e.g., "Excel:2024:Row42")

## File Structure

```
production/
├── README.md                      # This file
├── .env.template                  # Template for environment variables
├── .env                           # Your actual credentials (git-ignored)
├── import_production.py           # Main import script
├── add_import_tracking_columns.sql # One-time migration
├── backups/                       # Auto-created backup directory
│   └── backup_YYYYMMDD_HHMMSS/   # Individual backup folders
└── previews/                      # Dry-run preview files
```

## Safety Features

1. **Automatic Backup**: Full database backup before every import
2. **Batch Tracking**: Every record tagged with import batch ID
3. **Dry Run Mode**: Preview everything before making changes
4. **Rollback Support**: Delete specific imports or restore from backup
5. **Deduplication**: Legal entities are checked for duplicates
6. **Row-by-Row Retry**: If a batch fails, individual rows are retried

## Importing Previous Years

Run the same script with different Excel files:

```bash
# Set the Excel file in .env or override:
EXCEL_FILE=/path/to/Portfolio_2023.xlsb python import_production.py --import
EXCEL_FILE=/path/to/Portfolio_2022.xlsb python import_production.py --import
```

Each import gets its own batch ID for independent rollback.
