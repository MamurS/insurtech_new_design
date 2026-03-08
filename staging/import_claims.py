#!/usr/bin/env python3
"""
Mosaic ERP - Claims Portfolio Importer (Staging)
Imports claims from encrypted .xls Excel file into staging Supabase database.

PREREQUISITES:
    Run this SQL in Supabase SQL Editor BEFORE importing:

    ALTER TABLE public.claims ALTER COLUMN policy_id DROP NOT NULL;
    ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS inward_reinsurance_id UUID REFERENCES public.inward_reinsurance(id);
    ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS source_type TEXT;
    ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS slip_number TEXT;
    ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS contract_number TEXT;

Usage:
    python import_claims.py --dry-run    # Preview mode
    python import_claims.py              # Real import
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
    import xlrd
    from supabase import create_client, Client
except ImportError as e:
    print(f"Missing required package: {e}")
    print("Install with: pip install supabase xlrd msoffcrypto-tool python-dotenv")
    sys.exit(1)

# ==============================================================================
# Configuration
# ==============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
EXCEL_FILE = os.getenv("CLAIMS_FILE", "INWARD_CLAIMS_PORTFOLIO.xls")
EXCEL_PASSWORD = os.getenv("EXCEL_PASSWORD", "0110")

BATCH_SIZE = 50
PREVIEW_ROWS = 20

# Claim source type mappings
SOURCE_TYPE_MAP = {
    "foreign inward": "inward-foreign",
    "local inward": "inward-domestic",
    "domestic inward": "inward-domestic",
    "direct": "direct",
    "local outward": "outward",
}

# ==============================================================================
# Helper Functions
# ==============================================================================

def decrypt_xls(file_path: str, password: str = "") -> str:
    """Decrypt an encrypted .xls file using msoffcrypto-tool."""
    decrypted_path = tempfile.mktemp(suffix=".xls")

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


def parse_date(value: Any) -> Optional[str]:
    """Parse various date formats to ISO string."""
    if value is None or value == "":
        return None

    # Already a datetime object
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    # Excel serial number (days since 1899-12-30)
    if isinstance(value, (int, float)):
        if value == 0:
            return None
        try:
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
    if value is None or value == "":
        return None

    if isinstance(value, (int, float)):
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
            return float(cleaned)
        except ValueError:
            return None

    return None


def get_cell_value(sheet, row_idx: int, col_idx: int) -> Any:
    """Safely get cell value from xlrd sheet."""
    try:
        cell = sheet.cell(row_idx, col_idx)
        if cell.ctype == xlrd.XL_CELL_EMPTY:
            return None
        if cell.ctype == xlrd.XL_CELL_DATE:
            try:
                dt = xlrd.xldate_as_datetime(cell.value, sheet.book.datemode)
                return dt
            except:
                return cell.value
        return cell.value
    except IndexError:
        return None


def determine_source_type(col0_value: Any) -> str:
    """Determine source type from column 0 value."""
    if col0_value is None:
        return "unknown"

    val_lower = str(col0_value).strip().lower()

    for key, source_type in SOURCE_TYPE_MAP.items():
        if key in val_lower:
            return source_type

    return "unknown"


def determine_liability_type(reserve: Optional[float], paid: Optional[float]) -> str:
    """Determine if claim is ACTIVE or INFORMATIONAL."""
    if (reserve and reserve > 0) or (paid and paid > 0):
        return "ACTIVE"
    return "INFORMATIONAL"


def determine_status(paid: Optional[float], outstanding: Optional[float]) -> str:
    """Determine claim status: OPEN or CLOSED."""
    if outstanding and outstanding > 0:
        return "OPEN"
    if paid and paid > 0:
        return "CLOSED"
    return "OPEN"


# ==============================================================================
# Parent Record Matching
# ==============================================================================

def build_lookup_maps(supabase: Client) -> Tuple[Dict, Dict, Dict]:
    """
    Query existing records and build lookup maps for matching.
    Returns: (policies_by_number, policies_by_slip, inward_by_contract)
    """
    print("\n  Building lookup maps...")

    # Fetch policies
    policies_by_number: Dict[str, str] = {}
    policies_by_slip: Dict[str, str] = {}

    try:
        result = supabase.table("policies").select("id, \"policyNumber\", \"slipNumber\"").execute()
        policies = result.data or []

        for p in policies:
            if p.get("policyNumber"):
                policies_by_number[str(p["policyNumber"]).strip().lower()] = p["id"]
            if p.get("slipNumber"):
                policies_by_slip[str(p["slipNumber"]).strip().lower()] = p["id"]

        print(f"    Policies loaded: {len(policies)} (by number: {len(policies_by_number)}, by slip: {len(policies_by_slip)})")
    except Exception as e:
        print(f"    Warning: Could not fetch policies: {e}")

    # Fetch inward reinsurance
    inward_by_contract: Dict[str, str] = {}

    try:
        result = supabase.table("inward_reinsurance").select("id, contract_number").execute()
        inward_records = result.data or []

        for ir in inward_records:
            if ir.get("contract_number"):
                inward_by_contract[str(ir["contract_number"]).strip().lower()] = ir["id"]

        print(f"    Inward reinsurance loaded: {len(inward_records)} (by contract: {len(inward_by_contract)})")
    except Exception as e:
        print(f"    Warning: Could not fetch inward_reinsurance: {e}")

    return policies_by_number, policies_by_slip, inward_by_contract


def match_parent(
    source_type: str,
    slip_number: Optional[str],
    contract_number: Optional[str],
    policies_by_number: Dict[str, str],
    policies_by_slip: Dict[str, str],
    inward_by_contract: Dict[str, str]
) -> Tuple[Optional[str], Optional[str]]:
    """
    Match claim to parent record based on source type.
    Returns: (policy_id, inward_reinsurance_id)
    """
    policy_id = None
    inward_id = None

    slip_key = str(slip_number).strip().lower() if slip_number else ""
    contract_key = str(contract_number).strip().lower() if contract_number else ""

    if source_type in ["inward-foreign", "inward-domestic"]:
        # Match to inward_reinsurance by slip/contract number
        if slip_key and slip_key in inward_by_contract:
            inward_id = inward_by_contract[slip_key]
        elif contract_key and contract_key in inward_by_contract:
            inward_id = inward_by_contract[contract_key]

    elif source_type == "direct":
        # Match to policies by policy number
        if contract_key and contract_key in policies_by_number:
            policy_id = policies_by_number[contract_key]

    elif source_type == "outward":
        # Match to policies by slip number
        if slip_key and slip_key in policies_by_slip:
            policy_id = policies_by_slip[slip_key]
        elif contract_key and contract_key in policies_by_number:
            policy_id = policies_by_number[contract_key]

    return policy_id, inward_id


# ==============================================================================
# Row Parsing
# ==============================================================================

def parse_claim_row(
    sheet,
    row_idx: int,
    row_number: int,
    policies_by_number: Dict[str, str],
    policies_by_slip: Dict[str, str],
    inward_by_contract: Dict[str, str]
) -> Tuple[Optional[Dict], List[Dict]]:
    """
    Parse a single claim row.
    Returns: (claim_record, list_of_transactions)
    """
    # Get key values
    col0 = get_cell_value(sheet, row_idx, 0)  # Source type
    source_type = determine_source_type(col0)

    # Skip if empty row
    if source_type == "unknown" and not col0:
        return None, []

    # Extract all columns
    loss_date = parse_date(get_cell_value(sheet, row_idx, 1))
    report_date = parse_date(get_cell_value(sheet, row_idx, 2))
    claim_number_raw = get_cell_value(sheet, row_idx, 3)
    broker_reinsurer = get_cell_value(sheet, row_idx, 4)
    slip_number = get_cell_value(sheet, row_idx, 5)
    slip_date = get_cell_value(sheet, row_idx, 6)
    claimant_name = get_cell_value(sheet, row_idx, 7)
    reinsured = get_cell_value(sheet, row_idx, 8)
    insurance_type = get_cell_value(sheet, row_idx, 9)
    risk_description = get_cell_value(sheet, row_idx, 10)
    location_country = get_cell_value(sheet, row_idx, 11)
    city = get_cell_value(sheet, row_idx, 12)
    contract_number = get_cell_value(sheet, row_idx, 13)
    currency = get_cell_value(sheet, row_idx, 14)

    # Financial columns
    sum_insured_usd = parse_number(get_cell_value(sheet, row_idx, 15))
    sum_insured = parse_number(get_cell_value(sheet, row_idx, 16))
    our_share_decimal = parse_number(get_cell_value(sheet, row_idx, 25))
    reserve_fc = parse_number(get_cell_value(sheet, row_idx, 33))
    reserve_nc = parse_number(get_cell_value(sheet, row_idx, 34))
    total_loss = parse_number(get_cell_value(sheet, row_idx, 35))
    our_share_loss_decimal = parse_number(get_cell_value(sheet, row_idx, 37))
    our_share_loss_fc = parse_number(get_cell_value(sheet, row_idx, 38))
    our_share_loss_nc = parse_number(get_cell_value(sheet, row_idx, 39))
    paid_fc = parse_number(get_cell_value(sheet, row_idx, 40))
    exchange_rate = parse_number(get_cell_value(sheet, row_idx, 41))
    paid_nc = parse_number(get_cell_value(sheet, row_idx, 42))
    payment_date = parse_date(get_cell_value(sheet, row_idx, 43))
    outstanding = parse_number(get_cell_value(sheet, row_idx, 44))
    description = get_cell_value(sheet, row_idx, 46)

    # Convert our_share from decimal to percentage (0.005 -> 0.5)
    our_share_percentage = None
    if our_share_decimal is not None:
        our_share_percentage = our_share_decimal * 100

    # Generate claim number if missing
    claim_number = str(claim_number_raw).strip() if claim_number_raw else f"IMP-CLM-{row_number}"

    # Match to parent record
    policy_id, inward_id = match_parent(
        source_type,
        slip_number,
        contract_number,
        policies_by_number,
        policies_by_slip,
        inward_by_contract
    )

    # Determine liability type and status
    liability_type = determine_liability_type(reserve_fc, paid_fc)
    status = determine_status(paid_fc, outstanding)

    # Calculate imported totals
    imported_total_incurred = max(total_loss or 0, reserve_fc or 0)
    imported_total_paid = paid_fc or 0

    # Build notes from extra fields
    notes_parts = []
    if broker_reinsurer:
        notes_parts.append(f"Broker/Reinsurer: {broker_reinsurer}")
    if reinsured:
        notes_parts.append(f"Reinsured: {reinsured}")
    if insurance_type:
        notes_parts.append(f"Insurance Type: {insurance_type}")
    if risk_description:
        notes_parts.append(f"Risk: {risk_description}")
    if city:
        notes_parts.append(f"City: {city}")
    notes = " | ".join(notes_parts) if notes_parts else None

    # Build claim record
    claim: Dict[str, Any] = {
        "claim_number": claim_number,
        "source_type": source_type,
        "slip_number": str(slip_number).strip() if slip_number else None,
        "contract_number": str(contract_number).strip() if contract_number else None,
        "liability_type": liability_type,
        "status": status,
        "loss_date": loss_date,
        "report_date": report_date or datetime.now().strftime("%Y-%m-%d"),
        "description": str(description)[:1000] if description else notes,
        "claimant_name": str(claimant_name).strip() if claimant_name else None,
        "location_country": str(location_country).strip() if location_country else None,
        "imported_total_incurred": imported_total_incurred,
        "imported_total_paid": imported_total_paid,
        "is_deleted": False,
    }

    # Add parent references (nullable)
    if policy_id:
        claim["policy_id"] = policy_id
    if inward_id:
        claim["inward_reinsurance_id"] = inward_id

    # Build transactions
    transactions: List[Dict] = []

    # Reserve transaction
    if reserve_fc and reserve_fc > 0:
        transactions.append({
            "transaction_type": "RESERVE_SET",
            "transaction_date": loss_date or datetime.now().strftime("%Y-%m-%d"),
            "amount_100pct": total_loss or reserve_fc,
            "currency": str(currency).strip().upper() if currency else "USD",
            "exchange_rate": exchange_rate or 1,
            "our_share_percentage": our_share_percentage or 100,
            "notes": "Imported from Excel portfolio (reserve)",
        })

    # Payment transaction
    if paid_fc and paid_fc > 0:
        transactions.append({
            "transaction_type": "PAYMENT",
            "transaction_date": payment_date or loss_date or datetime.now().strftime("%Y-%m-%d"),
            "amount_100pct": paid_fc,
            "currency": str(currency).strip().upper() if currency else "USD",
            "exchange_rate": exchange_rate or 1,
            "our_share_percentage": our_share_percentage or 100,
            "notes": "Imported from Excel portfolio (payment)",
        })

    return claim, transactions


# ==============================================================================
# Main Import Logic
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Import claims from Excel to staging")
    parser.add_argument("--dry-run", action="store_true", help="Preview mode, no database changes")
    args = parser.parse_args()

    print("=" * 60)
    print("MOSAIC ERP - Claims Portfolio Importer (Staging)")
    print("=" * 60)

    # Validate configuration
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
        sys.exit(1)

    if not os.path.exists(EXCEL_FILE):
        print(f"ERROR: Excel file not found: {EXCEL_FILE}")
        print(f"  Expected: {os.path.abspath(EXCEL_FILE)}")
        sys.exit(1)

    print(f"\nConfiguration:")
    print(f"  Supabase URL: {SUPABASE_URL[:50]}...")
    print(f"  Excel File: {EXCEL_FILE}")
    print(f"  Mode: {'DRY RUN (preview only)' if args.dry_run else 'IMPORT'}")
    print()

    # Step 1: Decrypt Excel file
    print("Step 1: Decrypting Excel file...")
    try:
        decrypted_path = decrypt_xls(EXCEL_FILE, EXCEL_PASSWORD)
    except Exception as e:
        print(f"ERROR: Failed to decrypt file: {e}")
        sys.exit(1)

    # Step 2: Open workbook with xlrd
    print("\nStep 2: Opening workbook...")
    try:
        workbook = xlrd.open_workbook(decrypted_path)
        sheet_names = workbook.sheet_names()
        print(f"  Available sheets: {sheet_names}")

        # Find "Claim" sheet
        sheet = None
        for name in sheet_names:
            if "claim" in name.lower():
                sheet = workbook.sheet_by_name(name)
                print(f"  Using sheet: {name}")
                break

        if sheet is None:
            sheet = workbook.sheet_by_index(0)
            print(f"  Using first sheet: {sheet.name}")

        print(f"  Rows: {sheet.nrows}, Columns: {sheet.ncols}")
    except Exception as e:
        print(f"ERROR: Failed to open workbook: {e}")
        sys.exit(1)

    # Step 3: Connect to Supabase and build lookup maps
    print("\nStep 3: Connecting to Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {e}")
        sys.exit(1)

    policies_by_number, policies_by_slip, inward_by_contract = build_lookup_maps(supabase)

    # Step 4: Parse all claim rows
    print("\nStep 4: Parsing claims...")
    claims: List[Dict] = []
    all_transactions: List[Tuple[int, Dict]] = []  # (claim_index, transaction)

    # Track matching statistics
    match_stats = {
        "total": 0,
        "matched_policy": 0,
        "matched_inward": 0,
        "unmatched": 0,
        "by_source_type": {},
    }

    # Data starts at row 2 (row 0 = headers, row 1 = sub-headers)
    data_start_row = 2

    for row_idx in range(data_start_row, sheet.nrows):
        row_number = row_idx + 1

        claim, transactions = parse_claim_row(
            sheet, row_idx, row_number,
            policies_by_number, policies_by_slip, inward_by_contract
        )

        if claim:
            claims.append(claim)
            claim_idx = len(claims) - 1

            # Store transactions with claim index for later
            for txn in transactions:
                all_transactions.append((claim_idx, txn))

            # Track statistics
            match_stats["total"] += 1
            source_type = claim.get("source_type", "unknown")
            match_stats["by_source_type"][source_type] = match_stats["by_source_type"].get(source_type, 0) + 1

            if claim.get("policy_id"):
                match_stats["matched_policy"] += 1
            elif claim.get("inward_reinsurance_id"):
                match_stats["matched_inward"] += 1
            else:
                match_stats["unmatched"] += 1

    print(f"\n  Parsed: {len(claims)} claims")
    print(f"  Transactions to create: {len(all_transactions)}")
    print(f"\n  Match Statistics:")
    print(f"    Matched to policies: {match_stats['matched_policy']}")
    print(f"    Matched to inward_reinsurance: {match_stats['matched_inward']}")
    print(f"    Unmatched (will store slip/contract for manual linking): {match_stats['unmatched']}")
    print(f"\n  By Source Type:")
    for st, count in sorted(match_stats["by_source_type"].items()):
        print(f"    {st}: {count}")

    # Dry Run Mode
    if args.dry_run:
        print("\n" + "=" * 60)
        print("DRY RUN MODE - Saving preview to claims_preview.json")
        print("=" * 60)

        preview_data = {
            "claims": claims[:PREVIEW_ROWS],
            "transactions_sample": [
                {"claim_index": idx, "transaction": txn}
                for idx, txn in all_transactions[:20]
            ],
            "match_statistics": match_stats,
        }

        with open("claims_preview.json", "w", encoding="utf-8") as f:
            json.dump(preview_data, f, indent=2, ensure_ascii=False, default=str)

        print(f"\nPreview saved: claims_preview.json")
        print(f"  Claims: {min(len(claims), PREVIEW_ROWS)} of {len(claims)}")
        print(f"  Transactions: {min(len(all_transactions), 20)} of {len(all_transactions)}")
        print("\nReview the preview, then run without --dry-run to import")
        print("\nIMPORTANT: Run this SQL in Supabase SQL Editor FIRST:")
        print("-" * 60)
        print("""
ALTER TABLE public.claims ALTER COLUMN policy_id DROP NOT NULL;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS inward_reinsurance_id UUID REFERENCES public.inward_reinsurance(id);
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS slip_number TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS contract_number TEXT;
        """)
        print("-" * 60)

        # Cleanup
        if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
            os.remove(decrypted_path)

        return

    # Step 5: Insert claims
    print("\nStep 5: Inserting claims...")
    inserted_claims = 0
    claim_id_map: Dict[int, str] = {}  # Map claim index to inserted UUID

    for batch_start in range(0, len(claims), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(claims))
        batch = claims[batch_start:batch_end]
        batch_num = (batch_start // BATCH_SIZE) + 1

        print(f"  Batch {batch_num}: claims {batch_start + 1} - {batch_end}...", end=" ")

        try:
            result = supabase.table("claims").insert(batch).execute()

            # Store claim IDs for transaction linking
            for i, record in enumerate(result.data):
                claim_id_map[batch_start + i] = record["id"]

            inserted_claims += len(batch)
            print(f"OK ({len(batch)} claims)")
        except Exception as e:
            print(f"FAILED")
            print(f"    Error: {e}")

            # Retry row by row
            print(f"    Retrying row-by-row...")
            for i, claim in enumerate(batch):
                try:
                    result = supabase.table("claims").insert(claim).execute()
                    claim_id_map[batch_start + i] = result.data[0]["id"]
                    inserted_claims += 1
                except Exception as row_error:
                    print(f"      Failed: {claim.get('claim_number')} - {str(row_error)[:100]}")

    # Step 6: Insert transactions
    print("\nStep 6: Inserting claim transactions...")
    inserted_transactions = 0

    # Build transactions with claim_id
    transactions_to_insert: List[Dict] = []
    for claim_idx, txn in all_transactions:
        if claim_idx in claim_id_map:
            txn["claim_id"] = claim_id_map[claim_idx]
            transactions_to_insert.append(txn)

    for batch_start in range(0, len(transactions_to_insert), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(transactions_to_insert))
        batch = transactions_to_insert[batch_start:batch_end]
        batch_num = (batch_start // BATCH_SIZE) + 1

        print(f"  Batch {batch_num}: transactions {batch_start + 1} - {batch_end}...", end=" ")

        try:
            supabase.table("claim_transactions").insert(batch).execute()
            inserted_transactions += len(batch)
            print(f"OK ({len(batch)} transactions)")
        except Exception as e:
            print(f"FAILED")
            print(f"    Error: {e}")

            # Retry row by row
            for txn in batch:
                try:
                    supabase.table("claim_transactions").insert(txn).execute()
                    inserted_transactions += 1
                except Exception as row_error:
                    print(f"      Failed: {str(row_error)[:100]}")

    # Summary
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"  Claims Inserted: {inserted_claims} of {len(claims)}")
    print(f"  Transactions Inserted: {inserted_transactions} of {len(transactions_to_insert)}")
    print(f"\n  Match Statistics:")
    print(f"    Matched to policies: {match_stats['matched_policy']}")
    print(f"    Matched to inward_reinsurance: {match_stats['matched_inward']}")
    print(f"    Unmatched: {match_stats['unmatched']}")

    # Cleanup
    if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
        os.remove(decrypted_path)


if __name__ == "__main__":
    main()
