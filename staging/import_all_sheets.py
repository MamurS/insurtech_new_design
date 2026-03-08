#!/usr/bin/env python3
"""
Mosaic ERP - Multi-Sheet Portfolio Importer (Staging)
Imports all 4 sheets from Excel into staging Supabase database.

Sheets:
  1. "Insurance Contracts" → policies table (camelCase columns)
  2. "Outward" → policies table (as outward reinsurance records)
  3. "Outward RE Slıp №" → slips table (camelCase columns)
  4. "Inward" → inward_reinsurance table (already imported, skip by default)

Usage:
    python import_all_sheets.py --dry-run              # Preview all sheets
    python import_all_sheets.py --sheet contracts      # Import sheet 1 only
    python import_all_sheets.py --sheet outward        # Import sheet 2 only
    python import_all_sheets.py --sheet slips          # Import sheet 3 only
    python import_all_sheets.py --all                  # Import all sheets
"""

import os
import sys
import json
import argparse
import tempfile
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

# Load environment variables
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

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jwauzanxuwmwvvkojwmx.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
EXCEL_FILE = os.getenv("EXCEL_FILE", "Reinsurance_Portfolio_-2021-2026.xlsb")
EXCEL_PASSWORD = os.getenv("EXCEL_PASSWORD", "0110")

BATCH_SIZE = 50
PREVIEW_ROWS = 10

# ==============================================================================
# Sheet 1: Insurance Contracts → policies (camelCase)
# ==============================================================================
CONTRACTS_SHEET_PATTERNS = ["insurance contracts", "insurance", "contracts", "договор"]

# CORRECT Column mappings (0-indexed Excel columns → policies camelCase columns)
# Col 0 = Row number (SKIP)
# Data starts at Row 2 (Row 0 = headers, Row 1 = sub-headers/totals)
CONTRACTS_HEADER_ROWS = 2  # Skip first 2 rows

CONTRACTS_TEXT_COLUMNS: Dict[int, str] = {
    1: 'insuredName',              # B: Insured name (e.g. "RES DANISMANLIK")
    2: 'industry',                 # C: Industry
    3: 'brokerName',               # D: Broker (also used to derive intermediaryType)
    4: 'policyNumber',             # E: Policy number (e.g. "AIC/D/TPRP/0000000016/0621/001")
    6: 'classOfInsurance',         # G: Class of insurance (numeric code as text)
    7: 'typeOfInsurance',          # H: Type (e.g. "Property Damage")
    8: 'secondaryPolicyNumber',    # I: Secondary policy number
    9: 'riskCode',                 # J: Risk code
    10: 'territory',               # K: Territory (e.g. "Uzbekistan")
    11: 'city',                    # L: City (e.g. "Tashkent")
    12: 'currency',                # M: Currency (e.g. "USD")
    33: 'receivedPremiumCurrency', # AH: Currency of payment received
}

CONTRACTS_DATE_COLUMNS: Dict[int, str] = {
    5: 'accountingDate',           # F: Accounting date
    20: 'inceptionDate',           # U: Inception date
    21: 'expiryDate',              # V: Expiry date
    29: 'premiumPaymentDate',      # AD: First installment/payment date
    36: 'actualPaymentDate',       # AK: Actual payment date
}

CONTRACTS_NUMERIC_COLUMNS: Dict[int, str] = {
    13: 'exchangeRate',            # N: Exchange rate
    15: 'sumInsured',              # P: Sum insured (foreign currency)
    16: 'sumInsuredNational',      # Q: Sum insured (UZS)
    17: 'premiumRate',             # R: Premium rate (decimal)
    18: 'grossPremium',            # S: Gross premium (foreign currency)
    19: 'premiumNationalCurrency', # T: Premium (UZS)
    22: 'insuranceDays',           # W: Insurance days
    26: 'ourShare',                # AA: AIC share (percentage, default 100)
    32: 'receivedPremiumForeign',  # AG: Paid amount (foreign currency)
    34: 'receivedPremiumExchangeRate',  # AI: Exchange rate at payment
    35: 'receivedPremiumNational', # AJ: Paid amount (UZS)
}

# ==============================================================================
# Sheet 2: Outward → policies (as outward reinsurance rows)
# ==============================================================================
OUTWARD_SHEET_PATTERNS = ["outward", "исходящ"]

# CORRECT Column mappings based on actual Excel inspection:
# Row 0 = headers, Row 1 = totals/sub-headers, Data starts at Row 2
OUTWARD_HEADER_ROWS = 2  # Skip first 2 rows

OUTWARD_TEXT_COLUMNS: Dict[int, str] = {
    # Col 0 = Row number (№ п/п) - SKIP
    1: 'insuredName',              # Col 1: Insured
    2: 'brokerName',               # Col 2: Broker
    3: 'reinsurerName',            # Col 3: Reinsurer / Retrocessioner
    6: 'slipNumber',               # Col 6: Номер перестраховочного слипа (Slip number)
    9: 'classOfInsurance',         # Col 9: Класс (Class)
    10: 'typeOfInsurance',         # Col 10: Вид страхо-вания (Type of insurance)
    11: 'policyNumber',            # Col 11: Номер полиса (Policy number)
    15: 'territory',               # Col 15: Территория страхования (Territory)
    17: 'currency',                # Col 17: Валюта (Currency)
    32: 'reinsuranceType',         # Col 32: Тип перестрахования (Reinsurance type)
}

OUTWARD_DATE_COLUMNS: Dict[int, str] = {
    8: 'accountingDate',            # Col 8: Дата бухг. начис-ления (Accounting date)
    26: 'inceptionDate',            # Col 26: Период страхования start (Insurance period start)
    27: 'expiryDate',               # Col 27: Insurance period end
    29: 'reinsuranceInceptionDate', # Col 29: Период перестрахования start (RI inception)
    30: 'reinsuranceExpiryDate',    # Col 30: RI expiry
    63: 'actualPaymentDate',        # Col 63: Дата фактической оплаты (Actual payment date)
}

OUTWARD_NUMERIC_COLUMNS: Dict[int, str] = {
    18: 'exchangeRate',            # Col 18: Exchange rate (Курс валюты)
    21: 'sumInsured',              # Col 21: Страховая сумма в иностранной валюте (Sum insured foreign)
    22: 'sumInsuredNational',      # Col 22: Страховая сумма в сумах (Sum insured national)
    24: 'grossPremium',            # Col 24: Страховая премия в иностранной валюте (Gross premium foreign)
    25: 'premiumNationalCurrency', # Col 25: Страховая премия в сумах (Premium national)
    28: 'insuranceDays',           # Col 28: Insurance days
    31: 'reinsuranceDays',         # Col 31: RI days
    33: 'limitForeignCurrency',    # Col 33: Reinsurance Programme limit foreign
    34: 'limitNationalCurrency',   # Col 34: Limit national
    40: 'cededShare',              # Col 40: Доля перестра-ховщика (Ceded share %)
    42: 'cededPremiumForeign',     # Col 42: Валовая премия в иностранной валюте (Ceded premium foreign)
    43: 'cededPremiumNational',    # Col 43: Валовая премия в сумах (Ceded premium national)
    46: 'sumReinsuredForeign',     # Col 46: Обязательства перестраховщика в ин.вал. (Sum reinsured foreign)
    47: 'sumReinsuredNational',    # Col 47: Обязательства перестраховщика в сумах (Sum reinsured national)
    48: 'reinsuranceCommission',   # Col 48: Перестраховочная комиссия (RI commission %)
    54: 'netReinsurancePremium',   # Col 54: Нетто премия в иностранной валюте (Net RI premium foreign)
    59: 'receivedPremiumForeign',  # Col 59: Оплачена в иностранной валюте (Received premium foreign)
    62: 'receivedPremiumNational', # Col 62: Оплачена в сумах (Received premium national)
}

# ==============================================================================
# Sheet 3: Outward RE Slips → slips (camelCase)
# ==============================================================================
SLIPS_SHEET_PATTERNS = ["slip", "слип", "outward re"]

SLIPS_TEXT_COLUMNS: Dict[int, str] = {
    0: 'slipNumber',               # A: Slip number
    2: 'insuredName',              # C: Insured
    3: 'brokerReinsurer',          # D: Broker/Reinsurer
    6: 'currency',                 # G: Currency
}

SLIPS_DATE_COLUMNS: Dict[int, str] = {
    1: 'date',                     # B: Slip date
}

SLIPS_NUMERIC_COLUMNS: Dict[int, str] = {
    4: 'limitOfLiability',         # E: Limit
    5: 'limitNational',            # F: Limit national (extra, will add to notes)
}

# ==============================================================================
# Sheet 4: Inward → inward_reinsurance (snake_case) - SKIP by default
# ==============================================================================
INWARD_SHEET_PATTERNS = ["inward", "входящ"]

INWARD_TEXT_COLUMNS: Dict[int, str] = {
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

INWARD_DATE_COLUMNS: Dict[int, str] = {
    25: 'inception_date',
    26: 'expiry_date',
}

INWARD_NUMERIC_COLUMNS: Dict[int, str] = {
    32: 'limit_of_liability',
    35: 'deductible',
    39: 'our_share',
    41: 'gross_premium',
    45: 'commission_percent',
    48: 'net_premium',
}

INWARD_STRUCTURE_COLUMN = 31
INWARD_NOTES_COLUMNS = [2, 3, 6, 8, 9, 10, 13, 17, 18, 20, 21]


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

    print(f"  Decrypted to: {decrypted_path}")
    return decrypted_path


def find_sheet_by_pattern(wb, patterns: List[str]) -> Tuple[Any, str, bool]:
    """Find sheet matching any of the given patterns."""
    sheet_names = wb.sheets

    for name in sheet_names:
        name_lower = name.lower()
        for pattern in patterns:
            if pattern in name_lower:
                print(f"  Found sheet: {name}")
                return wb.get_sheet(name), name, True

    return None, "", False


def find_header_row(rows: List, max_rows: int = 15) -> int:
    """Auto-detect header row by searching for common headers."""
    keywords = ["insured", "policy", "договор", "застрахован", "slip", "contract", "premium"]

    for row_idx, row in enumerate(rows):
        if row_idx >= max_rows:
            break
        for cell in row:
            if cell.v:
                cell_str = str(cell.v).lower()
                for keyword in keywords:
                    if keyword in cell_str:
                        print(f"  Found header row at index {row_idx}")
                        return row_idx

    print("  Header row not found, assuming row 0")
    return 0


def parse_date(value: Any) -> Optional[str]:
    """Parse various date formats to ISO string."""
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    # Excel serial number (days since 1899-12-30)
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

        formats = [
            "%d.%m.%Y",
            "%Y-%m-%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%Y/%m/%d",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue

        return None

    return None


def parse_number(value: Any) -> Optional[float]:
    """Parse numeric values, handling various formats."""
    import math

    if value is None:
        return None

    if isinstance(value, (int, float)):
        # Handle infinity and NaN values
        if math.isinf(value) or math.isnan(value):
            return None
        return float(value)

    if isinstance(value, str):
        cleaned = value.strip()
        cleaned = cleaned.replace(",", "")
        cleaned = cleaned.replace(" ", "")
        cleaned = cleaned.replace("\u00a0", "")
        cleaned = cleaned.replace("$", "")
        cleaned = cleaned.replace("€", "")
        cleaned = cleaned.replace("%", "")

        if not cleaned or cleaned == "-":
            return None

        try:
            result = float(cleaned)
            # Check if the converted value is infinity or NaN
            if math.isinf(result) or math.isnan(result):
                return None
            return result
        except ValueError:
            return None

    return None


def get_cell_value(row: List, col_idx: int) -> Any:
    """Safely get cell value from row."""
    if col_idx < len(row):
        cell = row[col_idx]
        return cell.v if hasattr(cell, 'v') else cell
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


# ==============================================================================
# Sheet Parsers
# ==============================================================================

def parse_contracts_row(row: List, row_number: int) -> Optional[Dict[str, Any]]:
    """Parse Insurance Contracts row into policies record."""
    record: Dict[str, Any] = {}

    # Text columns
    for col_idx, field_name in CONTRACTS_TEXT_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = str(value).strip() if value else None

    # Date columns
    for col_idx, field_name in CONTRACTS_DATE_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_date(value)

    # Numeric columns
    for col_idx, field_name in CONTRACTS_NUMERIC_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        parsed = parse_number(value)
        # Convert insuranceDays to integer (database expects INTEGER)
        if field_name == 'insuranceDays' and parsed is not None:
            parsed = int(parsed)
        record[field_name] = parsed

    # Skip rows where insuredName (Col 1) is empty
    if not record.get('insuredName'):
        return None

    # Derive intermediaryType from brokerName
    broker_name = record.get('brokerName', '')
    if broker_name and broker_name.lower() == 'direct':
        record['intermediaryType'] = 'Direct'
        record['intermediaryName'] = None
    else:
        record['intermediaryType'] = 'Broker'
        record['intermediaryName'] = broker_name if broker_name else None

    # Set defaults (use Title Case to match frontend expectations)
    record['channel'] = 'Direct'
    record['recordType'] = 'Direct'  # Changed from 'INSURANCE'
    record['status'] = 'Active'
    record['isDeleted'] = False
    record['hasOutwardReinsurance'] = False

    # Default ourShare to 100 if not set
    if record.get('ourShare') is None:
        record['ourShare'] = 100

    if not record.get('currency'):
        record['currency'] = 'USD'

    return record


def parse_outward_row(row: List, row_number: int) -> Optional[Dict[str, Any]]:
    """Parse Outward row into policies record (as outward reinsurance)."""
    record: Dict[str, Any] = {}

    # Text columns
    for col_idx, field_name in OUTWARD_TEXT_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = str(value).strip() if value else None

    # Date columns
    for col_idx, field_name in OUTWARD_DATE_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_date(value)

    # Numeric columns
    for col_idx, field_name in OUTWARD_NUMERIC_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        parsed = parse_number(value)
        # Convert days fields to integer (database expects INTEGER)
        if field_name in ('reinsuranceDays', 'insuranceDays') and parsed is not None:
            parsed = int(parsed)
        record[field_name] = parsed

    # Skip empty rows
    if not record.get('policyNumber') and not record.get('insuredName') and not record.get('slipNumber'):
        return None

    # Set defaults (use Title Case to match frontend expectations)
    record['channel'] = 'Reinsurance'
    record['recordType'] = 'OUTWARD'
    record['status'] = 'Active'
    record['hasOutwardReinsurance'] = True

    if not record.get('currency'):
        record['currency'] = 'USD'

    # Build reinsurers JSONB if we have reinsurer info
    if record.get('reinsurerName'):
        reinsurer_entry = {
            'name': record['reinsurerName'],
            'share': record.get('cededShare'),
            'premium': record.get('cededPremiumForeign'),
        }
        record['reinsurers'] = json.dumps([reinsurer_entry])

    return record


def parse_slips_row(row: List, row_number: int) -> Optional[Dict[str, Any]]:
    """Parse Slips row into slips record."""
    record: Dict[str, Any] = {}

    # Text columns
    for col_idx, field_name in SLIPS_TEXT_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = str(value).strip() if value else None

    # Date columns
    for col_idx, field_name in SLIPS_DATE_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_date(value)

    # Numeric columns
    for col_idx, field_name in SLIPS_NUMERIC_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        parsed = parse_number(value)
        if field_name == 'limitNational':
            # Add to notes instead of a separate field
            if parsed:
                record['notes'] = f"Limit (national): {parsed}"
        else:
            record[field_name] = parsed

    # Skip empty rows
    if not record.get('slipNumber'):
        return None

    # Set defaults
    record['isDeleted'] = False
    record['reinsurers'] = json.dumps([])

    if not record.get('currency'):
        record['currency'] = 'USD'

    # Remove non-existent field
    record.pop('limitNational', None)

    return record


def parse_inward_row(row: List, row_number: int) -> Optional[Dict[str, Any]]:
    """Parse Inward row into inward_reinsurance record."""
    record: Dict[str, Any] = {}

    # Text columns
    for col_idx, field_name in INWARD_TEXT_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = str(value).strip() if value else None

    # Date columns
    for col_idx, field_name in INWARD_DATE_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_date(value)

    # Numeric columns
    for col_idx, field_name in INWARD_NUMERIC_COLUMNS.items():
        value = get_cell_value(row, col_idx)
        record[field_name] = parse_number(value)

    # Structure
    structure_value = get_cell_value(row, INWARD_STRUCTURE_COLUMN)
    record['structure'] = parse_structure(structure_value)

    # Notes from multiple columns
    notes_parts = []
    for col_idx in INWARD_NOTES_COLUMNS:
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

    # UW year from inception
    if record.get('inception_date'):
        try:
            record['uw_year'] = int(record['inception_date'][:4])
        except (ValueError, TypeError):
            record['uw_year'] = datetime.now().year
    else:
        record['uw_year'] = datetime.now().year

    # Required field fallbacks
    if not record.get('contract_number'):
        record['contract_number'] = f"IMPORT-{row_number}"

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


# ==============================================================================
# Import Functions
# ==============================================================================

def import_sheet(
    supabase: Client,
    table_name: str,
    records: List[Dict[str, Any]],
    dry_run: bool = True,
    sheet_name: str = ""
) -> Tuple[int, int]:
    """Import records to a table with batch processing."""
    if dry_run:
        preview_file = f"preview_{sheet_name.replace(' ', '_').lower()}.json"
        preview_data = records[:PREVIEW_ROWS]
        with open(preview_file, "w", encoding="utf-8") as f:
            json.dump(preview_data, f, indent=2, ensure_ascii=False, default=str)
        print(f"  Preview saved: {preview_file} ({len(preview_data)} records)")
        return len(records), 0

    inserted_count = 0
    error_count = 0

    for batch_start in range(0, len(records), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(records))
        batch = records[batch_start:batch_end]
        batch_num = (batch_start // BATCH_SIZE) + 1

        print(f"    Batch {batch_num}: rows {batch_start + 1} - {batch_end}...", end=" ")

        try:
            result = supabase.table(table_name).insert(batch).execute()
            inserted_count += len(batch)
            print(f"OK ({len(batch)} records)")
        except Exception as e:
            print(f"FAILED")
            print(f"      Error: {e}")

            # Retry row by row
            print(f"      Retrying row-by-row...")
            for record in batch:
                try:
                    supabase.table(table_name).insert(record).execute()
                    inserted_count += 1
                except Exception as row_error:
                    error_count += 1
                    identifier = record.get('policyNumber') or record.get('slipNumber') or record.get('contract_number') or 'unknown'
                    print(f"        Failed: {identifier} - {str(row_error)[:100]}")

    return inserted_count, error_count


def process_sheet(
    wb,
    sheet_patterns: List[str],
    parse_func,
    table_name: str,
    supabase: Optional[Client],
    dry_run: bool,
    header_rows: Optional[int] = None  # If specified, skip this many rows instead of auto-detecting
) -> Tuple[int, int, int]:
    """Process a single sheet and import to database."""
    sheet, sheet_name, found = find_sheet_by_pattern(wb, sheet_patterns)

    if not found:
        print(f"  Sheet not found for patterns: {sheet_patterns}")
        return 0, 0, 0

    print(f"\nProcessing sheet: {sheet_name}")

    rows = list(sheet.rows())

    # Use specified header rows or auto-detect
    if header_rows is not None:
        header_row_idx = header_rows - 1  # Convert to 0-indexed
        print(f"  Using specified header rows: {header_rows} (data starts at row {header_rows + 1})")
    else:
        header_row_idx = find_header_row(rows)

    parsed_records: List[Dict[str, Any]] = []
    skipped_count = 0

    for row_idx, row in enumerate(rows):
        if row_idx <= header_row_idx:
            continue

        row_number = row_idx + 1
        record = parse_func(row, row_number)

        if record:
            parsed_records.append(record)
        else:
            skipped_count += 1

    print(f"  Parsed: {len(parsed_records)} records")
    print(f"  Skipped (empty): {skipped_count} rows")

    if not parsed_records:
        return 0, 0, skipped_count

    # Preview first 3 records before import
    print(f"\n  Preview of first 3 records:")
    for i, rec in enumerate(parsed_records[:3]):
        print(f"    Record {i+1}:")
        print(f"      policyNumber: {rec.get('policyNumber')}")
        print(f"      insuredName: {rec.get('insuredName')}")
        print(f"      brokerName: {rec.get('brokerName')}")
        print(f"      territory: {rec.get('territory')}")
        print(f"      currency: {rec.get('currency')}")
        print(f"      sumInsured: {rec.get('sumInsured')}")
        print(f"      grossPremium: {rec.get('grossPremium')}")
        print(f"      inceptionDate: {rec.get('inceptionDate')}")
        print(f"      expiryDate: {rec.get('expiryDate')}")
    print()

    inserted, errors = import_sheet(
        supabase, table_name, parsed_records, dry_run, sheet_name
    )

    return inserted if not dry_run else len(parsed_records), errors, skipped_count


# ==============================================================================
# Main
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Import Excel sheets to staging database")
    parser.add_argument("--dry-run", action="store_true", help="Preview mode, no database changes")
    parser.add_argument("--sheet", choices=["contracts", "outward", "slips", "inward"], help="Import specific sheet only")
    parser.add_argument("--all", action="store_true", help="Import all sheets (except inward)")
    args = parser.parse_args()

    print("=" * 60)
    print("MOSAIC ERP - Multi-Sheet Portfolio Importer (Staging)")
    print("=" * 60)

    if not args.dry_run and not args.sheet and not args.all:
        print("\nUsage:")
        print("  --dry-run          Preview all sheets")
        print("  --sheet <name>     Import specific sheet")
        print("  --all              Import all sheets (except inward)")
        sys.exit(0)

    dry_run = args.dry_run

    # Validate config
    if not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_SERVICE_KEY must be set")
        sys.exit(1)

    if not os.path.exists(EXCEL_FILE):
        print(f"ERROR: Excel file not found: {EXCEL_FILE}")
        sys.exit(1)

    print(f"\nConfiguration:")
    print(f"  Supabase URL: {SUPABASE_URL[:50]}...")
    print(f"  Excel File: {EXCEL_FILE}")
    print(f"  Mode: {'DRY RUN (preview only)' if dry_run else 'IMPORT'}")
    print()

    # Decrypt Excel
    print("Step 1: Decrypting Excel file...")
    try:
        decrypted_path = decrypt_xlsb(EXCEL_FILE, EXCEL_PASSWORD)
    except Exception as e:
        print(f"ERROR: Failed to decrypt file: {e}")
        sys.exit(1)

    # Open workbook
    print("\nStep 2: Opening workbook...")
    try:
        wb = open_workbook(decrypted_path)
        print(f"  Available sheets: {wb.sheets}")
    except Exception as e:
        print(f"ERROR: Failed to open workbook: {e}")
        sys.exit(1)

    # Connect to Supabase
    supabase = None
    if not dry_run:
        print("\nStep 3: Connecting to Supabase...")
        try:
            supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        except Exception as e:
            print(f"ERROR: Failed to connect to Supabase: {e}")
            sys.exit(1)

    # Track totals
    total_inserted = 0
    total_errors = 0
    total_skipped = 0

    # Process sheets based on arguments
    sheets_to_process = []

    if args.all:
        sheets_to_process = ["contracts", "outward", "slips"]
    elif args.sheet:
        sheets_to_process = [args.sheet]
    else:
        # Dry run - preview all sheets
        sheets_to_process = ["contracts", "outward", "slips", "inward"]

    print(f"\nStep {'4' if not dry_run else '3'}: Processing sheets...")

    for sheet_type in sheets_to_process:
        if sheet_type == "contracts":
            # Insurance Contracts: skip 2 header rows (Row 0 = headers, Row 1 = sub-headers/totals)
            inserted, errors, skipped = process_sheet(
                wb, CONTRACTS_SHEET_PATTERNS, parse_contracts_row, "policies", supabase, dry_run,
                header_rows=CONTRACTS_HEADER_ROWS
            )
        elif sheet_type == "outward":
            # Outward: skip 2 header rows (Row 0 = headers, Row 1 = totals/sub-headers)
            inserted, errors, skipped = process_sheet(
                wb, OUTWARD_SHEET_PATTERNS, parse_outward_row, "policies", supabase, dry_run,
                header_rows=OUTWARD_HEADER_ROWS
            )
        elif sheet_type == "slips":
            inserted, errors, skipped = process_sheet(
                wb, SLIPS_SHEET_PATTERNS, parse_slips_row, "slips", supabase, dry_run
            )
        elif sheet_type == "inward":
            inserted, errors, skipped = process_sheet(
                wb, INWARD_SHEET_PATTERNS, parse_inward_row, "inward_reinsurance", supabase, dry_run
            )
        else:
            continue

        total_inserted += inserted
        total_errors += errors
        total_skipped += skipped

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total Records: {total_inserted}")
    print(f"  Errors: {total_errors}")
    print(f"  Skipped (empty): {total_skipped}")

    if dry_run:
        print("\n  Mode: DRY RUN - No changes made to database")
        print("  Review preview files, then run with --sheet or --all to import")

    # Cleanup
    if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
        os.remove(decrypted_path)


if __name__ == "__main__":
    main()
