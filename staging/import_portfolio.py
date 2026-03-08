#!/usr/bin/env python3
"""
Mosaic ERP - Inward Reinsurance Portfolio Importer
Reads encrypted .xlsb Excel files and batch-inserts into Supabase inward_reinsurance table.

Usage:
    1. Set up .env from .env.template
    2. DRY_RUN=true python import_portfolio.py   # Preview mode
    3. DRY_RUN=false python import_portfolio.py  # Real import
"""

import os
import sys
import json
import tempfile
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

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
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

BATCH_SIZE = 50
PREVIEW_ROWS = 20

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

STRUCTURE_COLUMN = 31  # "%" -> PROPORTIONAL, "XL" -> NON_PROPORTIONAL
NOTES_COLUMNS = [2, 3, 6, 8, 9, 10, 13, 17, 18, 20, 21]  # Extra info -> notes field


# ==============================================================================
# Helper Functions
# ==============================================================================

def decrypt_xlsb(file_path: str, password: str = "") -> str:
    """Decrypt an encrypted .xlsb file using msoffcrypto-tool."""
    decrypted_path = tempfile.mktemp(suffix=".xlsb")

    with open(file_path, "rb") as f:
        file = msoffcrypto.OfficeFile(f)

        # Check if file is actually encrypted
        if not file.is_encrypted():
            print(f"  File is not encrypted, using directly")
            return file_path

        file.load_key(password=password)

        with open(decrypted_path, "wb") as out:
            file.decrypt(out)

    print(f"  Decrypted to: {decrypted_path}")
    return decrypted_path


def find_sheet(wb) -> Tuple[Any, str]:
    """Find the sheet containing Inward reinsurance data."""
    sheet_names = wb.sheets

    # Look for sheet with "Inward" or "Входящ" (Russian) in name
    for name in sheet_names:
        if "inward" in name.lower() or "входящ" in name.lower():
            print(f"  Found sheet: {name}")
            return wb.get_sheet(name), name

    # Fallback to first sheet
    first_sheet = sheet_names[0] if sheet_names else None
    if first_sheet:
        print(f"  Using first sheet: {first_sheet}")
        return wb.get_sheet(first_sheet), first_sheet

    raise ValueError("No sheets found in workbook")


def find_header_row(sheet, max_rows: int = 15) -> int:
    """Auto-detect header row by searching for 'Insured' or 'Застрахованный'."""
    for row_idx, row in enumerate(sheet.rows()):
        if row_idx >= max_rows:
            break
        for cell in row:
            if cell.v:
                cell_str = str(cell.v).lower()
                if "insured" in cell_str or "застрахован" in cell_str:
                    print(f"  Found header row at index {row_idx}")
                    return row_idx

    print("  Header row not found, assuming row 0")
    return 0


def parse_date(value: Any) -> Optional[str]:
    """Parse various date formats to ISO string."""
    if value is None:
        return None

    # Already a datetime object
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    # Excel serial number (days since 1899-12-30)
    if isinstance(value, (int, float)):
        try:
            # Excel epoch is Dec 30, 1899
            excel_epoch = datetime(1899, 12, 30)
            result = excel_epoch + timedelta(days=int(value))
            return result.strftime("%Y-%m-%d")
        except (ValueError, OverflowError):
            return None

    # String parsing
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None

        # Try various formats
        formats = [
            "%d.%m.%Y",  # 31.12.2025
            "%Y-%m-%d",  # 2025-12-31
            "%m/%d/%Y",  # 12/31/2025
            "%d/%m/%Y",  # 31/12/2025
            "%Y/%m/%d",  # 2025/12/31
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        print(f"    Warning: Could not parse date: {value}")
        return None

    return None


def parse_number(value: Any) -> Optional[float]:
    """Parse numeric values, handling various formats."""
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        # Remove common formatting
        cleaned = value.strip()
        cleaned = cleaned.replace(",", "")  # Remove commas
        cleaned = cleaned.replace(" ", "")  # Remove spaces
        cleaned = cleaned.replace("\u00a0", "")  # Remove non-breaking spaces
        cleaned = cleaned.replace("$", "")
        cleaned = cleaned.replace("€", "")
        cleaned = cleaned.replace("%", "")

        if not cleaned or cleaned == "-":
            return None

        try:
            return float(cleaned)
        except ValueError:
            return None

    return None


def parse_structure(value: Any) -> str:
    """Parse structure column: '%' -> PROPORTIONAL, 'XL' -> NON_PROPORTIONAL."""
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

    if currency:
        if currency.upper() == "UZS":
            return "DOMESTIC"

    return "FOREIGN"


def get_cell_value(row: List, col_idx: int) -> Any:
    """Safely get cell value from row."""
    if col_idx < len(row):
        cell = row[col_idx]
        return cell.v if hasattr(cell, 'v') else cell
    return None


def parse_row(row: List, row_number: int) -> Optional[Dict[str, Any]]:
    """Parse a single Excel row into an inward_reinsurance record."""
    record: Dict[str, Any] = {}
    warnings: List[str] = []

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
    record['type'] = 'FAC'  # Always FAC for imported data
    record['status'] = 'ACTIVE'
    record['cedant_country'] = record.get('territory')

    # Extract UW year from inception date
    if record.get('inception_date'):
        try:
            year = int(record['inception_date'][:4])
            record['uw_year'] = year
        except (ValueError, TypeError):
            record['uw_year'] = datetime.now().year
    else:
        record['uw_year'] = datetime.now().year

    # Required field fallbacks with warnings
    if not record.get('contract_number'):
        record['contract_number'] = f"IMPORT-{row_number}"
        warnings.append(f"Row {row_number}: Missing contract_number, using IMPORT-{row_number}")

    if not record.get('cedant_name'):
        record['cedant_name'] = "Unknown Cedant"
        warnings.append(f"Row {row_number}: Missing cedant_name, using 'Unknown Cedant'")

    if not record.get('type_of_cover'):
        record['type_of_cover'] = "Property"
        warnings.append(f"Row {row_number}: Missing type_of_cover, using 'Property'")

    if not record.get('class_of_cover'):
        record['class_of_cover'] = "All Risks"
        warnings.append(f"Row {row_number}: Missing class_of_cover, using 'All Risks'")

    today = datetime.now().strftime("%Y-%m-%d")
    next_year = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")

    if not record.get('inception_date'):
        record['inception_date'] = today
        warnings.append(f"Row {row_number}: Missing inception_date, using today")

    if not record.get('expiry_date'):
        record['expiry_date'] = next_year
        warnings.append(f"Row {row_number}: Missing expiry_date, using today+365")

    # Default currency
    if not record.get('currency'):
        record['currency'] = 'USD'

    # Default numeric fields
    if record.get('limit_of_liability') is None:
        record['limit_of_liability'] = 0
    if record.get('gross_premium') is None:
        record['gross_premium'] = 0
    if record.get('our_share') is None:
        record['our_share'] = 100

    # Print warnings
    for warning in warnings:
        print(f"    {warning}")

    return record


# ==============================================================================
# Main Import Logic
# ==============================================================================

def main():
    print("=" * 60)
    print("MOSAIC ERP - Inward Reinsurance Portfolio Importer")
    print("=" * 60)

    # Validate configuration
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        sys.exit(1)

    if not os.path.exists(EXCEL_FILE):
        print(f"ERROR: Excel file not found: {EXCEL_FILE}")
        sys.exit(1)

    print(f"\nConfiguration:")
    print(f"  Supabase URL: {SUPABASE_URL[:50]}...")
    print(f"  Excel File: {EXCEL_FILE}")
    print(f"  Dry Run: {DRY_RUN}")
    print()

    # Step 1: Decrypt Excel file
    print("Step 1: Decrypting Excel file...")
    try:
        decrypted_path = decrypt_xlsb(EXCEL_FILE, EXCEL_PASSWORD)
    except Exception as e:
        print(f"ERROR: Failed to decrypt file: {e}")
        sys.exit(1)

    # Step 2: Open workbook and find sheet
    print("\nStep 2: Opening workbook...")
    try:
        wb = open_workbook(decrypted_path)
        sheet, sheet_name = find_sheet(wb)
    except Exception as e:
        print(f"ERROR: Failed to open workbook: {e}")
        sys.exit(1)

    # Step 3: Find header row
    print("\nStep 3: Finding header row...")
    rows = list(sheet.rows())
    header_row_idx = find_header_row(sheet)

    # Step 4: Parse all rows
    print("\nStep 4: Parsing rows...")
    parsed_records: List[Dict[str, Any]] = []
    skipped_count = 0

    for row_idx, row in enumerate(rows):
        # Skip header and rows before it
        if row_idx <= header_row_idx:
            continue

        row_number = row_idx + 1  # 1-indexed for display
        record = parse_row(row, row_number)

        if record:
            parsed_records.append(record)
        else:
            skipped_count += 1

    print(f"\n  Parsed: {len(parsed_records)} records")
    print(f"  Skipped (empty): {skipped_count} rows")

    # Dry Run Mode: Save preview and exit
    if DRY_RUN:
        print("\n" + "=" * 60)
        print("DRY RUN MODE - Saving preview to import_preview.json")
        print("=" * 60)

        preview_data = parsed_records[:PREVIEW_ROWS]
        with open("import_preview.json", "w", encoding="utf-8") as f:
            json.dump(preview_data, f, indent=2, ensure_ascii=False, default=str)

        print(f"\nPreview saved: {len(preview_data)} records")
        print("Review import_preview.json, then set DRY_RUN=false to import")

        # Clean up decrypted file if different from original
        if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
            os.remove(decrypted_path)

        return

    # Step 5: Connect to Supabase
    print("\nStep 5: Connecting to Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        sys.exit(1)

    # Step 6: Batch insert
    print(f"\nStep 6: Inserting records in batches of {BATCH_SIZE}...")
    inserted_count = 0
    error_count = 0
    error_records: List[Dict] = []

    for batch_start in range(0, len(parsed_records), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(parsed_records))
        batch = parsed_records[batch_start:batch_end]
        batch_num = (batch_start // BATCH_SIZE) + 1

        print(f"  Batch {batch_num}: rows {batch_start + 1} - {batch_end}...", end=" ")

        try:
            result = supabase.table("inward_reinsurance").insert(batch).execute()
            inserted_count += len(batch)
            print(f"OK ({len(batch)} records)")
        except Exception as e:
            print(f"FAILED")
            print(f"    Error: {e}")

            # Retry row by row to isolate bad records
            print(f"    Retrying row-by-row...")
            for record in batch:
                try:
                    supabase.table("inward_reinsurance").insert(record).execute()
                    inserted_count += 1
                except Exception as row_error:
                    error_count += 1
                    error_records.append({
                        "contract_number": record.get("contract_number"),
                        "error": str(row_error)[:200]
                    })
                    print(f"      Failed: {record.get('contract_number')} - {str(row_error)[:100]}")

    # Summary
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"  Total Parsed:   {len(parsed_records)}")
    print(f"  Inserted:       {inserted_count}")
    print(f"  Errors:         {error_count}")
    print(f"  Skipped (empty): {skipped_count}")

    if error_records:
        print("\nFailed Records:")
        for err in error_records[:10]:
            print(f"  - {err['contract_number']}: {err['error'][:80]}")
        if len(error_records) > 10:
            print(f"  ... and {len(error_records) - 10} more")

    # Clean up
    if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
        os.remove(decrypted_path)


if __name__ == "__main__":
    main()
