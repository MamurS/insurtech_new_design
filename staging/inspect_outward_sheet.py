#!/usr/bin/env python3
"""
Inspect Outward sheet - print column headers and first 3 data rows.
This will show the actual column indices and values to build correct mappings.

Usage:
    python inspect_outward_sheet.py [path/to/excel/file.xlsb]
"""

import os
import sys
import tempfile

from dotenv import load_dotenv
load_dotenv()

try:
    import msoffcrypto
    from pyxlsb import open_workbook
except ImportError as e:
    print(f"Missing required package: {e}")
    print("Install with: pip install pyxlsb msoffcrypto-tool python-dotenv")
    sys.exit(1)

# Allow file path as command line argument
EXCEL_FILE = sys.argv[1] if len(sys.argv) > 1 else os.getenv("EXCEL_FILE", "Reinsurance_Portfolio_-2021-2026.xlsb")
EXCEL_PASSWORD = os.getenv("EXCEL_PASSWORD", "0110")


def decrypt_xlsb(file_path: str, password: str = "") -> str:
    """Decrypt an encrypted .xlsb file."""
    decrypted_path = tempfile.mktemp(suffix=".xlsb")

    with open(file_path, "rb") as f:
        file = msoffcrypto.OfficeFile(f)
        if not file.is_encrypted():
            return file_path
        file.load_key(password=password)
        with open(decrypted_path, "wb") as out:
            file.decrypt(out)

    return decrypted_path


def main():
    if not os.path.exists(EXCEL_FILE):
        print(f"ERROR: Excel file not found: {EXCEL_FILE}")
        sys.exit(1)

    print(f"Opening: {EXCEL_FILE}")
    decrypted_path = decrypt_xlsb(EXCEL_FILE, EXCEL_PASSWORD)

    wb = open_workbook(decrypted_path)
    print(f"Available sheets: {wb.sheets}")

    # Find Outward sheet
    outward_sheet = None
    outward_name = None
    for name in wb.sheets:
        if 'outward' in name.lower() and 'slip' not in name.lower() and 're' not in name.lower():
            outward_sheet = wb.get_sheet(name)
            outward_name = name
            break

    if not outward_sheet:
        # Try again with just "outward"
        for name in wb.sheets:
            if 'outward' in name.lower():
                outward_sheet = wb.get_sheet(name)
                outward_name = name
                break

    if not outward_sheet:
        print("ERROR: Could not find Outward sheet")
        print(f"Available: {wb.sheets}")
        sys.exit(1)

    print(f"\n{'='*80}")
    print(f"SHEET: {outward_name}")
    print(f"{'='*80}\n")

    rows = list(outward_sheet.rows())

    # Print first 5 rows to find headers
    print("FIRST 5 ROWS (to identify header row):")
    print("-" * 80)
    for row_idx in range(min(5, len(rows))):
        row = rows[row_idx]
        non_empty = [(i, cell.v) for i, cell in enumerate(row) if cell.v is not None]
        print(f"\nRow {row_idx}:")
        for col_idx, val in non_empty[:15]:  # First 15 non-empty columns
            print(f"  Col {col_idx}: {repr(val)[:60]}")

    # Find header row (row with column names like "Policy", "Insured", etc.)
    header_row_idx = 0
    for row_idx, row in enumerate(rows[:10]):
        for cell in row:
            if cell.v:
                cell_str = str(cell.v).lower()
                if any(kw in cell_str for kw in ['insured', 'policy', 'slip', 'broker', 'currency']):
                    header_row_idx = row_idx
                    break
        if header_row_idx > 0:
            break

    print(f"\n\n{'='*80}")
    print(f"DETECTED HEADER ROW: {header_row_idx}")
    print(f"{'='*80}\n")

    # Print header row
    header_row = rows[header_row_idx]
    print("HEADERS (column index -> header name):")
    print("-" * 80)
    for col_idx, cell in enumerate(header_row):
        if cell.v:
            print(f"  Col {col_idx:2d}: {cell.v}")

    # Print first 3 data rows with all columns
    print(f"\n\n{'='*80}")
    print("FIRST 3 DATA ROWS (after header)")
    print(f"{'='*80}\n")

    for data_row_num in range(1, 4):
        actual_row_idx = header_row_idx + data_row_num
        if actual_row_idx >= len(rows):
            break

        row = rows[actual_row_idx]
        print(f"\n--- Data Row {data_row_num} (Excel row {actual_row_idx + 1}) ---")

        for col_idx, cell in enumerate(row):
            header_name = ""
            if col_idx < len(header_row) and header_row[col_idx].v:
                header_name = f" ({header_row[col_idx].v})"

            val = cell.v
            if val is not None:
                val_repr = repr(val)[:50]
                print(f"  Col {col_idx:2d}{header_name}: {val_repr}")

    # Cleanup
    if decrypted_path != EXCEL_FILE and os.path.exists(decrypted_path):
        os.remove(decrypted_path)

    print(f"\n\n{'='*80}")
    print("Use the column indices above to build the correct mapping.")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
