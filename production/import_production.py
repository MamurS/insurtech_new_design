#!/usr/bin/env python3
"""
Mosaic ERP - Production Database Importer
Comprehensive import from ALL Excel sheets with:
- Pre-import backup/checkpoint for rollback
- Legal entities extraction and import
- Multi-sheet support (all years)
- Batch tracking for selective rollback

Usage:
    1. Copy .env.template to .env and configure
    2. python import_production.py --backup       # Create backup only
    3. python import_production.py --dry-run      # Preview import
    4. python import_production.py --import       # Execute import
    5. python import_production.py --rollback BATCH_ID  # Rollback specific import
"""

import os
import sys
import json
import argparse
import tempfile
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Set
from uuid import uuid4

# Load environment variables first
from dotenv import load_dotenv
load_dotenv()

# Required packages
try:
    import msoffcrypto
    from pyxlsb import open_workbook
    from supabase import create_client, Client
except ImportError as e:
    print(f"Missing required package: {e}")
    print("Install with: pip install supabase pyxlsb msoffcrypto-tool python-dotenv")
    sys.exit(1)

# ==============================================================================
# Configuration
# ==============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
EXCEL_FILE = os.getenv("EXCEL_FILE", "Reinsurance_Portfolio.xlsb")
EXCEL_PASSWORD = os.getenv("EXCEL_PASSWORD", "")

BATCH_SIZE = 50
BACKUP_DIR = "backups"

# Column mappings (0-indexed Excel columns -> inward_reinsurance snake_case columns)
TEXT_COLUMNS: Dict[int, str] = {
    1: 'original_insured_name',
    4: 'broker_name',
    5: 'cedant_name',
    7: 'contract_number',
    11: 'type_of_cover',
    12: 'class_of_cover',
    14: 'risk_description',
    15: 'industry',
    16: 'territory',
    19: 'currency',
}

DATE_COLUMNS: Dict[int, str] = {
    25: 'inception_date',
    26: 'expiry_date',
}

NUMERIC_COLUMNS: Dict[int, str] = {
    32: 'limit_of_liability',
    35: 'deductible',
    39: 'our_share',
    41: 'gross_premium',
    45: 'commission_percent',
    48: 'net_premium',
}

STRUCTURE_COLUMN = 31
NOTES_COLUMNS = [2, 3, 6, 8, 9, 10, 13, 17, 18, 20, 21]


# ==============================================================================
# Helper Functions
# ==============================================================================

def decrypt_xlsb(file_path: str, password: str = "") -> str:
    """Decrypt an encrypted .xlsb file using msoffcrypto-tool."""
    decrypted_path = tempfile.mktemp(suffix=".xlsb")

    with open(file_path, "rb") as f:
        file = msoffcrypto.OfficeFile(f)

        if not file.is_encrypted():
            print(f"  File is not encrypted, using directly")
            return file_path

        file.load_key(password=password)

        with open(decrypted_path, "wb") as out:
            file.decrypt(out)

    print(f"  Decrypted to temp file")
    return decrypted_path


def get_all_sheets(wb) -> List[str]:
    """Get all sheet names from workbook."""
    return wb.sheets


def find_header_row(rows: List, max_rows: int = 15) -> int:
    """Auto-detect header row by searching for 'Insured' or 'Застрахованный'."""
    for row_idx, row in enumerate(rows):
        if row_idx >= max_rows:
            break
        for cell in row:
            if cell.v:
                cell_str = str(cell.v).lower()
                if "insured" in cell_str or "застрахован" in cell_str:
                    return row_idx
    return 0


def parse_date(value: Any) -> Optional[str]:
    """Parse various date formats to ISO string."""
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    if isinstance(value, (int, float)):
        try:
            excel_epoch = datetime(1899, 12, 30)
            result = excel_epoch + timedelta(days=int(value))
            return result.strftime("%Y-%m-%d")
        except (ValueError, OverflowError):
            return None

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None

        formats = ["%d.%m.%Y", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None

    return None


def parse_number(value: Any) -> Optional[float]:
    """Parse numeric values, handling various formats."""
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        cleaned = value.strip().replace(",", "").replace(" ", "")
        cleaned = cleaned.replace("\u00a0", "").replace("$", "").replace("€", "").replace("%", "")

        if not cleaned or cleaned == "-":
            return None

        try:
            return float(cleaned)
        except ValueError:
            return None

    return None


def parse_structure(value: Any) -> str:
    """Parse structure column."""
    if value is None:
        return "PROPORTIONAL"

    val_str = str(value).strip().upper()
    if "XL" in val_str or "EXCESS" in val_str or "NON" in val_str:
        return "NON_PROPORTIONAL"

    return "PROPORTIONAL"


def determine_origin(territory: Optional[str], currency: Optional[str]) -> str:
    """Determine origin based on territory/country and currency."""
    if territory:
        territory_lower = territory.lower()
        if "uzbek" in territory_lower or territory_lower == "uz":
            return "DOMESTIC"

    if currency and currency.upper() == "UZS":
        return "DOMESTIC"

    return "FOREIGN"


def get_cell_value(row: List, col_idx: int) -> Any:
    """Safely get cell value from row."""
    if col_idx < len(row):
        cell = row[col_idx]
        return cell.v if hasattr(cell, 'v') else cell
    return None


def determine_entity_type(name: str, is_cedant: bool = False, is_broker: bool = False) -> str:
    """Determine legal entity type based on name and context."""
    name_lower = name.lower()

    if is_broker or "broker" in name_lower:
        return "Broker"

    if "insurance" in name_lower or "страхов" in name_lower or "insuranc" in name_lower:
        return "Insurance Company"

    if "reinsur" in name_lower or "перестрах" in name_lower:
        return "Reinsurer"

    if is_cedant:
        return "Insurance Company"  # Cedants are typically insurance companies

    return "Other"


def normalize_name(name: str) -> str:
    """Normalize entity name for deduplication."""
    if not name:
        return ""
    # Remove extra whitespace, convert to title case
    normalized = " ".join(name.split())
    return normalized.strip()


# ==============================================================================
# Backup Functions
# ==============================================================================

def create_backup(supabase: Client) -> str:
    """Create backup of current database state."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_subdir = os.path.join(BACKUP_DIR, f"backup_{timestamp}")
    os.makedirs(backup_subdir, exist_ok=True)

    tables = ["inward_reinsurance", "legal_entities", "policies", "claims", "slips"]
    backup_manifest = {
        "timestamp": timestamp,
        "tables": {}
    }

    print(f"\nCreating backup in: {backup_subdir}")

    for table in tables:
        try:
            print(f"  Backing up {table}...", end=" ")
            response = supabase.table(table).select("*").execute()
            records = response.data or []

            backup_file = os.path.join(backup_subdir, f"{table}.json")
            with open(backup_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2, ensure_ascii=False, default=str)

            backup_manifest["tables"][table] = {
                "count": len(records),
                "file": f"{table}.json"
            }
            print(f"{len(records)} records")
        except Exception as e:
            print(f"FAILED: {e}")
            backup_manifest["tables"][table] = {"count": 0, "error": str(e)}

    # Save manifest
    manifest_file = os.path.join(backup_subdir, "manifest.json")
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(backup_manifest, f, indent=2)

    print(f"\nBackup complete: {backup_subdir}")
    print(f"Manifest saved: {manifest_file}")

    return backup_subdir


def list_backups() -> List[str]:
    """List available backups."""
    if not os.path.exists(BACKUP_DIR):
        return []

    backups = []
    for name in os.listdir(BACKUP_DIR):
        path = os.path.join(BACKUP_DIR, name)
        if os.path.isdir(path) and name.startswith("backup_"):
            manifest_path = os.path.join(path, "manifest.json")
            if os.path.exists(manifest_path):
                backups.append(name)

    return sorted(backups, reverse=True)


def restore_from_backup(supabase: Client, backup_name: str) -> bool:
    """Restore database from a backup."""
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    manifest_path = os.path.join(backup_path, "manifest.json")

    if not os.path.exists(manifest_path):
        print(f"ERROR: Backup not found: {backup_path}")
        return False

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    print(f"\nRestoring from backup: {backup_name}")
    print(f"Backup timestamp: {manifest.get('timestamp')}")

    # Confirm
    confirm = input("\nThis will DELETE all current data and restore from backup. Continue? (yes/no): ")
    if confirm.lower() != "yes":
        print("Aborted.")
        return False

    for table, info in manifest["tables"].items():
        if info.get("error"):
            print(f"  Skipping {table} (backup had error)")
            continue

        backup_file = os.path.join(backup_path, info["file"])
        if not os.path.exists(backup_file):
            print(f"  Skipping {table} (file not found)")
            continue

        print(f"  Restoring {table}...", end=" ")

        try:
            # Delete all existing records
            supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

            # Load backup data
            with open(backup_file, "r", encoding="utf-8") as f:
                records = json.load(f)

            if records:
                # Insert in batches
                for i in range(0, len(records), BATCH_SIZE):
                    batch = records[i:i + BATCH_SIZE]
                    supabase.table(table).insert(batch).execute()

            print(f"OK ({len(records)} records)")
        except Exception as e:
            print(f"FAILED: {e}")
            return False

    print("\nRestore complete!")
    return True


# ==============================================================================
# Rollback by Batch ID
# ==============================================================================

def rollback_batch(supabase: Client, batch_id: str) -> bool:
    """Rollback a specific import batch."""
    print(f"\nRolling back batch: {batch_id}")

    tables = ["inward_reinsurance", "legal_entities"]

    for table in tables:
        try:
            print(f"  Checking {table}...", end=" ")

            # Count records with this batch_id
            count_response = supabase.table(table).select("id", count="exact").eq("import_batch_id", batch_id).execute()
            count = count_response.count or 0

            if count == 0:
                print(f"0 records")
                continue

            # Confirm deletion
            confirm = input(f"  Delete {count} records from {table}? (yes/no): ")
            if confirm.lower() != "yes":
                print("  Skipped")
                continue

            # Delete records with this batch_id
            supabase.table(table).delete().eq("import_batch_id", batch_id).execute()
            print(f"Deleted {count} records")

        except Exception as e:
            print(f"FAILED: {e}")

    print("\nRollback complete!")
    return True


# ==============================================================================
# Import Functions
# ==============================================================================

def parse_row(row: List, row_number: int, sheet_name: str, batch_id: str) -> Optional[Dict[str, Any]]:
    """Parse a single Excel row into an inward_reinsurance record."""
    record: Dict[str, Any] = {}

    # Text columns
    for col_idx, field_name in TEXT_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = str(value).strip() if value else None

    # Date columns
    for col_idx, field_name in DATE_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_date(value)

    # Numeric columns
    for col_idx, field_name in NUMERIC_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_number(value)

    # Structure
    structure_value = get_cell_value(row, STRUCTURE_COLUMN)
    record['structure'] = parse_structure(structure_value)

    # Concatenate notes columns
    notes_parts = []
    for col_idx in NOTES_COLUMNS:
        value = get_cell_value(row, col_idx)
        if value:
            notes_parts.append(str(value).strip())
    record['notes'] = " | ".join(notes_parts) if notes_parts else None

    # Skip empty rows
    if not record.get('cedant_name') and not record.get('contract_number') and not record.get('original_insured_name'):
        return None

    # Derived fields
    record['origin'] = determine_origin(record.get('territory'), record.get('currency'))
    record['type'] = 'FAC'
    record['status'] = 'ACTIVE'
    record['cedant_country'] = record.get('territory')
    record['import_batch_id'] = batch_id
    record['import_source'] = f"Excel:{sheet_name}:Row{row_number}"

    # Extract UW year from inception date or sheet name
    if record.get('inception_date'):
        try:
            year = int(record['inception_date'][:4])
            record['uw_year'] = year
        except (ValueError, TypeError):
            record['uw_year'] = extract_year_from_sheet_name(sheet_name)
    else:
        record['uw_year'] = extract_year_from_sheet_name(sheet_name)

    # Required field fallbacks
    if not record.get('contract_number'):
        record['contract_number'] = f"IMPORT-{sheet_name}-{row_number}"

    if not record.get('cedant_name'):
        record['cedant_name'] = "Unknown Cedant"

    if not record.get('type_of_cover'):
        record['type_of_cover'] = "Property"

    if not record.get('class_of_cover'):
        record['class_of_cover'] = "All Risks"

    today = datetime.now().strftime("%Y-%m-%d")
    next_year = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")

    if not record.get('inception_date'):
        record['inception_date'] = today

    if not record.get('expiry_date'):
        record['expiry_date'] = next_year

    if not record.get('currency'):
        record['currency'] = 'USD'

    if record.get('limit_of_liability') is None:
        record['limit_of_liability'] = 0
    if record.get('gross_premium') is None:
        record['gross_premium'] = 0
    if record.get('our_share') is None:
        record['our_share'] = 100

    return record


def extract_year_from_sheet_name(sheet_name: str) -> int:
    """Extract year from sheet name like '2024', 'Inward 2023', etc."""
    import re
    match = re.search(r'20\d{2}', sheet_name)
    if match:
        return int(match.group())
    return datetime.now().year


def extract_legal_entities(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract unique legal entities from import records."""
    entities: Dict[str, Dict[str, Any]] = {}  # keyed by normalized name

    for record in records:
        # Extract cedant
        cedant_name = record.get('cedant_name')
        if cedant_name and cedant_name != "Unknown Cedant":
            normalized = normalize_name(cedant_name)
            if normalized and normalized not in entities:
                entities[normalized] = {
                    "fullName": cedant_name.strip(),
                    "shortName": cedant_name.strip()[:50] if len(cedant_name) > 50 else None,
                    "type": determine_entity_type(cedant_name, is_cedant=True),
                    "country": record.get('cedant_country') or record.get('territory'),
                    "import_batch_id": record.get('import_batch_id'),
                }

        # Extract broker
        broker_name = record.get('broker_name')
        if broker_name:
            normalized = normalize_name(broker_name)
            if normalized and normalized not in entities:
                entities[normalized] = {
                    "fullName": broker_name.strip(),
                    "shortName": broker_name.strip()[:50] if len(broker_name) > 50 else None,
                    "type": determine_entity_type(broker_name, is_broker=True),
                    "country": None,  # Broker country not typically in the data
                    "import_batch_id": record.get('import_batch_id'),
                }

        # Extract original insured
        insured_name = record.get('original_insured_name')
        if insured_name:
            normalized = normalize_name(insured_name)
            if normalized and normalized not in entities:
                entities[normalized] = {
                    "fullName": insured_name.strip(),
                    "shortName": insured_name.strip()[:50] if len(insured_name) > 50 else None,
                    "type": "Insured",
                    "country": record.get('territory'),
                    "import_batch_id": record.get('import_batch_id'),
                }

    return list(entities.values())


def check_existing_entities(supabase: Client, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter out entities that already exist in the database."""
    if not entities:
        return []

    print("  Checking for existing entities...", end=" ")

    try:
        # Get all existing entity names
        response = supabase.table("legal_entities").select("fullName").execute()
        existing_names = {normalize_name(e["fullName"]) for e in (response.data or []) if e.get("fullName")}

        # Filter to only new entities
        new_entities = [e for e in entities if normalize_name(e["fullName"]) not in existing_names]

        print(f"{len(existing_names)} existing, {len(new_entities)} new")
        return new_entities
    except Exception as e:
        print(f"Error: {e}")
        return entities  # Return all if we can't check


def process_all_sheets(wb, batch_id: str) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """Process all sheets in the workbook."""
    all_records = []
    sheet_stats = {}

    sheet_names = get_all_sheets(wb)
    print(f"\nFound {len(sheet_names)} sheets: {sheet_names}")

    for sheet_name in sheet_names:
        # Skip sheets that don't look like data sheets
        if any(skip in sheet_name.lower() for skip in ['template', 'blank', 'summary', 'pivot', 'chart']):
            print(f"\n  Skipping sheet: {sheet_name}")
            continue

        print(f"\n  Processing sheet: {sheet_name}")

        try:
            sheet = wb.get_sheet(sheet_name)
            rows = list(sheet.rows())
            header_row_idx = find_header_row(rows)

            sheet_records = []
            for row_idx, row in enumerate(rows):
                if row_idx <= header_row_idx:
                    continue

                row_number = row_idx + 1
                record = parse_row(row, row_number, sheet_name, batch_id)

                if record:
                    sheet_records.append(record)

            all_records.extend(sheet_records)
            sheet_stats[sheet_name] = len(sheet_records)
            print(f"    Parsed: {len(sheet_records)} records")

        except Exception as e:
            print(f"    Error: {e}")
            sheet_stats[sheet_name] = 0

    return all_records, sheet_stats


# ==============================================================================
# Main Import Logic
# ==============================================================================

def run_import(dry_run: bool = True):
    """Run the full import process."""
    batch_id = str(uuid4())[:8]  # Short batch ID for easy reference

    print("=" * 70)
    print("MOSAIC ERP - Production Database Importer")
    print("=" * 70)
    print(f"\nBatch ID: {batch_id}")
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'LIVE IMPORT'}")

    # Validate configuration
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("\nERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        sys.exit(1)

    if not os.path.exists(EXCEL_FILE):
        print(f"\nERROR: Excel file not found: {EXCEL_FILE}")
        sys.exit(1)

    print(f"\nConfiguration:")
    print(f"  Supabase URL: {SUPABASE_URL[:50]}...")
    print(f"  Excel File: {EXCEL_FILE}")

    # Connect to Supabase
    print("\nConnecting to Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"ERROR: Failed to connect: {e}")
        sys.exit(1)

    # Create backup before import (only in live mode)
    if not dry_run:
        print("\n" + "-" * 70)
        print("STEP 1: Creating backup...")
        backup_path = create_backup(supabase)
        print(f"\nBackup created: {backup_path}")
        print("If anything goes wrong, you can restore from this backup.")

        confirm = input("\nProceed with import? (yes/no): ")
        if confirm.lower() != "yes":
            print("Aborted.")
            sys.exit(0)

    # Decrypt Excel file
    print("\n" + "-" * 70)
    print("STEP 2: Decrypting Excel file...")
    try:
        decrypted_path = decrypt_xlsb(EXCEL_FILE, EXCEL_PASSWORD)
    except Exception as e:
        print(f"ERROR: Failed to decrypt: {e}")
        sys.exit(1)

    # Open workbook and process all sheets
    print("\n" + "-" * 70)
    print("STEP 3: Processing all sheets...")
    try:
        wb = open_workbook(decrypted_path)
        all_records, sheet_stats = process_all_sheets(wb, batch_id)
    except Exception as e:
        print(f"ERROR: Failed to process workbook: {e}")
        sys.exit(1)

    print(f"\n  Total records parsed: {len(all_records)}")
    print(f"  Sheet breakdown:")
    for sheet_name, count in sheet_stats.items():
        print(f"    - {sheet_name}: {count} records")

    # Extract legal entities
    print("\n" + "-" * 70)
    print("STEP 4: Extracting legal entities...")
    all_entities = extract_legal_entities(all_records)
    print(f"  Found {len(all_entities)} unique entities")

    entity_types = {}
    for e in all_entities:
        t = e.get("type", "Unknown")
        entity_types[t] = entity_types.get(t, 0) + 1

    for etype, count in sorted(entity_types.items()):
        print(f"    - {etype}: {count}")

    # In live mode, check for existing entities
    new_entities = all_entities
    if not dry_run:
        new_entities = check_existing_entities(supabase, all_entities)

    # Dry Run: Save preview and exit
    if dry_run:
        print("\n" + "=" * 70)
        print("DRY RUN COMPLETE - Saving previews...")
        print("=" * 70)

        os.makedirs("previews", exist_ok=True)

        # Save sample records
        with open("previews/records_preview.json", "w", encoding="utf-8") as f:
            json.dump(all_records[:100], f, indent=2, ensure_ascii=False, default=str)

        # Save entities
        with open("previews/entities_preview.json", "w", encoding="utf-8") as f:
            json.dump(all_entities, f, indent=2, ensure_ascii=False, default=str)

        # Save stats
        stats = {
            "batch_id": batch_id,
            "total_records": len(all_records),
            "total_entities": len(all_entities),
            "sheet_stats": sheet_stats,
            "entity_types": entity_types,
        }
        with open("previews/import_stats.json", "w", encoding="utf-8") as f:
            json.dump(stats, f, indent=2)

        print(f"\nPreview files saved to ./previews/")
        print(f"  - records_preview.json (first 100 records)")
        print(f"  - entities_preview.json (all {len(all_entities)} entities)")
        print(f"  - import_stats.json")
        print(f"\nReview these files, then run with --import flag to execute.")

        # Cleanup
        if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
            os.remove(decrypted_path)

        return

    # LIVE IMPORT
    print("\n" + "-" * 70)
    print("STEP 5: Importing legal entities...")

    entities_inserted = 0
    entities_errors = 0

    if new_entities:
        for i in range(0, len(new_entities), BATCH_SIZE):
            batch = new_entities[i:i + BATCH_SIZE]
            batch_num = (i // BATCH_SIZE) + 1
            print(f"  Entity batch {batch_num}: {i + 1} - {min(i + BATCH_SIZE, len(new_entities))}...", end=" ")

            try:
                supabase.table("legal_entities").insert(batch).execute()
                entities_inserted += len(batch)
                print(f"OK")
            except Exception as e:
                print(f"FAILED: {e}")
                # Try one by one
                for entity in batch:
                    try:
                        supabase.table("legal_entities").insert(entity).execute()
                        entities_inserted += 1
                    except Exception as row_error:
                        entities_errors += 1
                        print(f"    Failed: {entity.get('fullName', 'Unknown')[:40]} - {str(row_error)[:50]}")

    print(f"\n  Entities inserted: {entities_inserted}")
    print(f"  Entities errors: {entities_errors}")

    print("\n" + "-" * 70)
    print("STEP 6: Importing inward reinsurance records...")

    records_inserted = 0
    records_errors = 0
    error_records = []

    for i in range(0, len(all_records), BATCH_SIZE):
        batch = all_records[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        print(f"  Record batch {batch_num}: {i + 1} - {min(i + BATCH_SIZE, len(all_records))}...", end=" ")

        try:
            supabase.table("inward_reinsurance").insert(batch).execute()
            records_inserted += len(batch)
            print(f"OK")
        except Exception as e:
            print(f"FAILED - retrying row by row...")

            for record in batch:
                try:
                    supabase.table("inward_reinsurance").insert(record).execute()
                    records_inserted += 1
                except Exception as row_error:
                    records_errors += 1
                    error_records.append({
                        "contract": record.get("contract_number"),
                        "error": str(row_error)[:100]
                    })

    # Summary
    print("\n" + "=" * 70)
    print("IMPORT COMPLETE")
    print("=" * 70)
    print(f"\n  Batch ID: {batch_id}")
    print(f"\n  Legal Entities:")
    print(f"    Inserted: {entities_inserted}")
    print(f"    Errors: {entities_errors}")
    print(f"\n  Inward Reinsurance Records:")
    print(f"    Inserted: {records_inserted}")
    print(f"    Errors: {records_errors}")

    if error_records:
        print(f"\n  First 10 error records:")
        for err in error_records[:10]:
            print(f"    - {err['contract']}: {err['error']}")

    print(f"\n  To rollback this import, run:")
    print(f"    python import_production.py --rollback {batch_id}")

    # Cleanup
    if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
        os.remove(decrypted_path)


# ==============================================================================
# CLI Entry Point
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Mosaic ERP Production Database Importer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python import_production.py --backup           Create backup only
  python import_production.py --dry-run          Preview import (no changes)
  python import_production.py --import           Execute full import
  python import_production.py --rollback abc123  Rollback batch abc123
  python import_production.py --list-backups     List available backups
  python import_production.py --restore backup_20260210_143000  Restore from backup
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--backup", action="store_true", help="Create backup only")
    group.add_argument("--dry-run", action="store_true", help="Preview import (no changes)")
    group.add_argument("--import", dest="do_import", action="store_true", help="Execute full import")
    group.add_argument("--rollback", metavar="BATCH_ID", help="Rollback a specific batch")
    group.add_argument("--list-backups", action="store_true", help="List available backups")
    group.add_argument("--restore", metavar="BACKUP_NAME", help="Restore from a backup")

    args = parser.parse_args()

    if args.backup or args.do_import or args.rollback or args.restore:
        # Validate configuration for operations that need Supabase
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
            sys.exit(1)

        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    if args.backup:
        create_backup(supabase)
    elif args.dry_run:
        run_import(dry_run=True)
    elif args.do_import:
        run_import(dry_run=False)
    elif args.rollback:
        rollback_batch(supabase, args.rollback)
    elif args.list_backups:
        backups = list_backups()
        if backups:
            print("Available backups:")
            for b in backups:
                print(f"  - {b}")
        else:
            print("No backups found.")
    elif args.restore:
        restore_from_backup(supabase, args.restore)


if __name__ == "__main__":
    main()
