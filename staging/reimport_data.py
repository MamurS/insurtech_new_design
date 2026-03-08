#!/usr/bin/env python3
"""
Mosaic ERP: Data Re-Import Script
Reads the password-protected XLSB workbook and generates SQL INSERT files.

Usage:
    python3 reimport_data.py

Output files (in same directory as this script):
    inserts_policies.sql   — Direct insurance contracts
    inserts_outward.sql    — Outward reinsurance cessions
    inserts_slips.sql      — Outward RE slip references
    inserts_inward.sql     — Inward reinsurance contracts
"""

import msoffcrypto
import io
import os
import sys
from datetime import datetime, timedelta
from pyxlsb import open_workbook

# ── Configuration ──

XLSB_PATH = '/home/user/InsurTech/staging/Reinsurance_Portfolio_-2021-2026.xlsb'
PASSWORD = '0110'
OUTPUT_DIR = '/mnt/user-data/outputs'

# Sheet names (note: Slıp uses Turkish dotless-ı and №)
SHEET_DIRECT = 'Insurance Contracts'
SHEET_OUTWARD = 'Outward'
SHEET_INWARD = 'Inward'
# Slip sheet name has special characters — we'll find it by prefix

# Domestic cedant keywords (case-insensitive)
DOMESTIC_KEYWORDS = [
    'ИНГО', 'UZBEK', 'УЗБЕК', 'KAFOLAT', 'GROSS', 'КАПИТАЛ', 'CAPITAL',
    'PSB', 'IMPEX', 'INSON', 'KAFIL', 'MY INSURANCE', 'INFINITY', 'NEO',
    'ALFA INVEST', 'TRUST INSURANCE', 'EUROASIA', 'ASIA INSUR',
    'ALP SUGURTA', "O'ZSUG'URTA", 'ИНГО-УЗБЕКИСТАН', 'ALFA', 'ASIA',
    'SAGDIANA', 'TEMIRYOL', 'AGROMIR',
]


# ── Helpers ──

def excel_date(serial):
    """Convert Excel serial number to YYYY-MM-DD string."""
    if serial is None or serial == '' or serial == 0:
        return None
    try:
        s = float(serial)
        if s < 1 or s > 100000:
            return None
        return (datetime(1899, 12, 30) + timedelta(days=s)).strftime('%Y-%m-%d')
    except (ValueError, TypeError, OverflowError):
        return None


def safe_num(val):
    """Convert value to float, return None if not numeric."""
    if val is None or val == '':
        return None
    try:
        f = float(val)
        return f
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Convert value to int, return None if not numeric."""
    n = safe_num(val)
    if n is None:
        return None
    return int(n)


def safe_str(val):
    """Convert value to stripped string, return None if empty."""
    if val is None:
        return None
    s = str(val).strip()
    if s == '' or s == 'None':
        return None
    return s


def sql_str(val):
    """Format a value for SQL: 'escaped_string' or NULL."""
    s = safe_str(val)
    if s is None:
        return 'NULL'
    # Escape single quotes
    s = s.replace("'", "''")
    return f"'{s}'"


def sql_num(val):
    """Format a numeric value for SQL: number or NULL."""
    n = safe_num(val)
    if n is None:
        return 'NULL'
    return str(n)


def sql_int(val):
    """Format an integer value for SQL: int or NULL."""
    n = safe_int(val)
    if n is None:
        return 'NULL'
    return str(n)


def sql_date(serial):
    """Convert Excel serial to SQL date literal or NULL."""
    d = excel_date(serial)
    if d is None:
        return 'NULL'
    return f"'{d}'"


def sql_bool(val):
    """Format a boolean for SQL."""
    if val is None:
        return 'false'
    return 'true' if val else 'false'


def is_domestic_cedant(cedant_name):
    """Check if a cedant name matches domestic insurance companies."""
    if not cedant_name:
        return False
    upper = cedant_name.upper()
    return any(kw in upper for kw in DOMESTIC_KEYWORDS)


def col(row, idx):
    """Safely get column value from a row by index."""
    if idx < len(row):
        return row[idx]
    return None


def decrypt_workbook(path, password):
    """Decrypt password-protected XLSB and return BytesIO."""
    print(f"Decrypting {path}...")
    with open(path, 'rb') as f:
        decrypted = io.BytesIO()
        ms = msoffcrypto.OfficeFile(f)
        ms.load_key(password=password)
        ms.decrypt(decrypted)
    print("  Decrypted successfully.")
    return decrypted


def read_sheet(wb, sheet_name, skip_rows=2):
    """Read all data rows from a sheet (skipping header rows)."""
    rows = []
    with wb.get_sheet(sheet_name) as sheet:
        for i, row in enumerate(sheet.rows()):
            if i < skip_rows:
                continue
            vals = [c.v for c in row]
            rows.append(vals)
    return rows


def find_slip_sheet(wb):
    """Find the slip sheet name (has special characters)."""
    for name in wb.sheets:
        if 'slip' in name.lower() or 'slıp' in name.lower():
            if 'outward' in name.lower():
                return name
    return None


# ── Insurance Contracts → policies (recordType='Direct') ──

def generate_direct_inserts(wb):
    """Generate INSERT statements for direct insurance contracts."""
    print(f"\nReading sheet: {SHEET_DIRECT}")
    rows = read_sheet(wb, SHEET_DIRECT)

    inserts = []
    skipped = 0

    for row in rows:
        insured = safe_str(col(row, 1))
        if not insured:
            skipped += 1
            continue

        policy_number = safe_str(col(row, 4))
        if not policy_number:
            skipped += 1
            continue

        inserts.append(
            f"""INSERT INTO policies (
    id, "recordType", channel, "intermediaryType",
    "insuredName", industry, "intermediaryName", "brokerName",
    "policyNumber", "accountingDate", "classOfInsurance", "typeOfInsurance",
    "secondaryPolicyNumber", "riskCode", territory, city,
    currency, "exchangeRate",
    "sumInsured", "sumInsuredNational",
    "premiumRate", "grossPremium", "grossPremiumNational",
    "inceptionDate", "expiryDate", "insuranceDays",
    "ourShare", "warrantyPeriod",
    "premiumPaymentDate",
    "receivedPremiumForeign", "receivedPremiumCurrency",
    "receivedPremiumExchangeRate", "receivedPremiumNational",
    "actualPaymentDate", "numberOfSlips",
    status, "isDeleted", "hasOutwardReinsurance",
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'Direct', 'Direct', {sql_str(safe_str(col(row, 3)) and 'Broker' or 'Direct')},
    {sql_str(col(row, 1))}, {sql_str(col(row, 2))}, {sql_str(col(row, 3))}, {sql_str(col(row, 3))},
    {sql_str(col(row, 4))}, {sql_date(col(row, 5))}, {sql_str(col(row, 6))}, {sql_str(col(row, 7))},
    {sql_str(col(row, 8))}, {sql_str(col(row, 9))}, {sql_str(col(row, 10))}, {sql_str(col(row, 11))},
    {sql_str(col(row, 12))}, {sql_num(col(row, 13))},
    {sql_num(col(row, 15))}, {sql_num(col(row, 16))},
    {sql_num(col(row, 17))}, {sql_num(col(row, 18))}, {sql_num(col(row, 19))},
    {sql_date(col(row, 20))}, {sql_date(col(row, 21))}, {sql_int(col(row, 22))},
    {sql_num(col(row, 26))}, {sql_int(col(row, 23))},
    {sql_date(col(row, 29))},
    {sql_num(col(row, 32))}, {sql_str(col(row, 33))},
    {sql_num(col(row, 34))}, {sql_num(col(row, 35))},
    {sql_date(col(row, 36))}, {sql_int(col(row, 64))},
    'Active', false, false,
    NOW(), NOW()
);"""
        )

    print(f"  Generated {len(inserts)} inserts, skipped {skipped} empty rows")
    return inserts


# ── Outward → policies (recordType='OUTWARD') ──

def generate_outward_inserts(wb):
    """Generate INSERT statements for outward reinsurance cessions."""
    print(f"\nReading sheet: {SHEET_OUTWARD}")
    rows = read_sheet(wb, SHEET_OUTWARD)

    inserts = []
    skipped = 0

    for row in rows:
        insured = safe_str(col(row, 1))
        if not insured:
            skipped += 1
            continue

        inserts.append(
            f"""INSERT INTO policies (
    id, "recordType", channel, "intermediaryType",
    "insuredName", "intermediaryName", "brokerName",
    "reinsurerName", "cedantName",
    "policyNumber", "dateOfSlip", "accountingDate",
    "classOfInsurance", "typeOfInsurance",
    "secondaryPolicyNumber", "riskCode",
    territory, city,
    currency, "exchangeRate",
    "sumInsured", "sumInsuredNational",
    "premiumRate",
    "fullPremiumForeign", "fullPremiumNational",
    "inceptionDate", "expiryDate", "insuranceDays",
    "reinsuranceInceptionDate", "reinsuranceExpiryDate", "reinsuranceDays",
    "reinsuranceType",
    "limitForeignCurrency",
    "excessForeignCurrency",
    "cededShare",
    "grossPremium", "grossPremiumNational",
    "selfRetention",
    "sumReinsuredForeign", "sumReinsuredNational",
    "commissionPercent", "reinsuranceCommission", "commissionNational",
    "taxPercent",
    "netPremium", "netPremiumNational",
    "premiumPaymentDate",
    "receivedPremiumForeign", "receivedPremiumCurrency",
    "receivedPremiumExchangeRate", "receivedPremiumNational",
    "actualPaymentDate",
    "numberOfSlips", "maxRetentionPerRisk",
    "slipNumber",
    status, "isDeleted", "hasOutwardReinsurance",
    created_at, updated_at
) VALUES (
    gen_random_uuid(), 'OUTWARD', 'Outward', 'Broker',
    {sql_str(col(row, 1))}, {sql_str(col(row, 2))}, {sql_str(col(row, 2))},
    {sql_str(col(row, 3))}, {sql_str(col(row, 4))},
    {sql_str(col(row, 6))}, {sql_date(col(row, 7))}, {sql_date(col(row, 8))},
    {sql_str(col(row, 9))}, {sql_str(col(row, 10))},
    {sql_str(col(row, 11))}, {sql_str(col(row, 12))},
    {sql_str(col(row, 15))}, {sql_str(col(row, 16))},
    {sql_str(col(row, 17))}, {sql_num(col(row, 18))},
    {sql_num(col(row, 21))}, {sql_num(col(row, 22))},
    {sql_num(col(row, 23))},
    {sql_num(col(row, 24))}, {sql_num(col(row, 25))},
    {sql_date(col(row, 26))}, {sql_date(col(row, 27))}, {sql_int(col(row, 28))},
    {sql_date(col(row, 29))}, {sql_date(col(row, 30))}, {sql_int(col(row, 31))},
    {sql_str(col(row, 32))},
    {sql_num(col(row, 33))},
    {sql_num(col(row, 35))},
    {sql_num(col(row, 40))},
    {sql_num(col(row, 42))}, {sql_num(col(row, 43))},
    {sql_num(col(row, 45))},
    {sql_num(col(row, 46))}, {sql_num(col(row, 47))},
    {sql_num(col(row, 48))}, {sql_num(col(row, 49))}, {sql_num(col(row, 50))},
    {sql_num(col(row, 51))},
    {sql_num(col(row, 54))}, {sql_num(col(row, 55))},
    {sql_date(col(row, 56))},
    {sql_num(col(row, 59))}, {sql_str(col(row, 60))},
    {sql_num(col(row, 61))}, {sql_num(col(row, 62))},
    {sql_date(col(row, 63))},
    {sql_int(col(row, 64))}, {sql_num(col(row, 65))},
    {sql_str(col(row, 6))},
    'Active', false, false,
    NOW(), NOW()
);"""
        )

    print(f"  Generated {len(inserts)} inserts, skipped {skipped} empty rows")
    return inserts


# ── Outward RE Slip → slips table ──

def generate_slip_inserts(wb):
    """Generate INSERT statements for outward RE slips."""
    slip_sheet = find_slip_sheet(wb)
    if not slip_sheet:
        print("\nWARNING: Slip sheet not found!")
        return []

    print(f"\nReading sheet: {slip_sheet}")
    rows = read_sheet(wb, slip_sheet)

    inserts = []
    skipped = 0

    for row in rows:
        slip_number = safe_str(col(row, 1))
        if not slip_number:
            skipped += 1
            continue

        inserts.append(
            f"""INSERT INTO slips (
    id, "slipNumber", date, "insuredName", "brokerReinsurer",
    currency, "limitOfLiability", status, "isDeleted",
    created_at, updated_at
) VALUES (
    gen_random_uuid(), {sql_str(col(row, 1))}, {sql_date(col(row, 2))}, {sql_str(col(row, 3))}, {sql_str(col(row, 4))},
    'USD', 0, 'Active', false,
    NOW(), NOW()
);"""
        )

    print(f"  Generated {len(inserts)} inserts, skipped {skipped} empty rows")
    return inserts


# ── Inward → inward_reinsurance ──

def generate_inward_inserts(wb):
    """Generate INSERT statements for inward reinsurance contracts."""
    print(f"\nReading sheet: {SHEET_INWARD}")
    rows = read_sheet(wb, SHEET_INWARD)

    inserts = []
    skipped = 0

    for row in rows:
        insured = safe_str(col(row, 1))
        if not insured:
            skipped += 1
            continue

        cedant = safe_str(col(row, 5))
        is_domestic = is_domestic_cedant(cedant)
        origin = 'DOMESTIC' if is_domestic else 'FOREIGN'
        ir_type = 'FAC'  # Default; can be refined

        # Determine structure from col 31
        structure_raw = safe_str(col(row, 31))
        if structure_raw:
            su = structure_raw.upper().strip()
            if su in ('XL', 'XOL', 'XS', 'EXCESS') or 'NON' in su or 'EXCESS' in su:
                structure = 'NON_PROPORTIONAL'
            else:
                structure = 'PROPORTIONAL'
        else:
            structure = 'PROPORTIONAL'

        # our_share: normalize decimal to percentage for storage
        our_share_raw = safe_num(col(row, 39))
        if our_share_raw is not None:
            # Store as percentage (the DB field is numeric, app reads it as-is)
            our_share = our_share_raw if our_share_raw > 1 else our_share_raw * 100
        else:
            our_share = None

        # commission_percent: normalize
        comm_raw = safe_num(col(row, 45))
        if comm_raw is not None:
            comm_pct = comm_raw if comm_raw > 1 else comm_raw * 100
        else:
            comm_pct = None

        # tax_percent: normalize
        tax_raw = safe_num(col(row, 47))
        if tax_raw is not None:
            tax_pct = tax_raw if tax_raw > 1 else tax_raw * 100
        else:
            tax_pct = None

        # Combine type_of_cover from cols 11 and 12
        type_part1 = safe_str(col(row, 11))
        type_part2 = safe_str(col(row, 12))
        if type_part1 and type_part2:
            type_of_cover = f"{type_part1} / {type_part2}"
        else:
            type_of_cover = type_part1 or type_part2

        inserts.append(
            f"""INSERT INTO inward_reinsurance (
    id, original_insured_name,
    borrower, broker_name, cedant_name, retrocedent,
    contract_number, reference_link,
    date_of_slip, accounting_date,
    type_of_cover, class_of_cover, risk_description, industry,
    territory, city, agreement_number,
    currency, exchange_rate,
    sum_insured_fc, sum_insured_uzs,
    inception_date, expiry_date, insurance_days,
    reinsurance_inception_date, reinsurance_expiry_date, reinsurance_days,
    structure, limit_of_liability,
    excess_point,
    premium_fc, premium_nc,
    our_share,
    gross_premium, gross_premium_uzs,
    sum_reinsured_fc, sum_reinsured_uzs,
    commission_percent, commission_nc,
    tax_percent,
    net_premium, net_premium_uzs,
    premium_payment_date, received_premium_currency,
    equivalent_usd, received_premium_uzs,
    actual_payment_date, number_of_slips,
    origin, type, status, is_deleted,
    created_at, updated_at
) VALUES (
    gen_random_uuid(), {sql_str(col(row, 1))},
    {sql_str(col(row, 3))}, {sql_str(col(row, 4))}, {sql_str(col(row, 5))}, {sql_str(col(row, 6))},
    {sql_str(col(row, 7))}, {sql_str(col(row, 8))},
    {sql_date(col(row, 9))}, {sql_date(col(row, 10))},
    {sql_str(type_of_cover)}, {sql_str(col(row, 13))}, {sql_str(col(row, 14))}, {sql_str(col(row, 15))},
    {sql_str(col(row, 16))}, {sql_str(col(row, 17))}, {sql_str(col(row, 18))},
    {sql_str(col(row, 19))}, {sql_num(col(row, 20))},
    {sql_num(col(row, 23))}, {sql_num(col(row, 24))},
    {sql_date(col(row, 25))}, {sql_date(col(row, 26))}, {sql_int(col(row, 27))},
    {sql_date(col(row, 28))}, {sql_date(col(row, 29))}, {sql_int(col(row, 30))},
    {sql_str(structure)}, {sql_num(col(row, 32))},
    {sql_num(col(row, 35))},
    {sql_num(col(row, 37))}, {sql_num(col(row, 38))},
    {sql_num(our_share)},
    {sql_num(col(row, 41))}, {sql_num(col(row, 42))},
    {sql_num(col(row, 43))}, {sql_num(col(row, 44))},
    {sql_num(comm_pct)}, {sql_num(col(row, 46))},
    {sql_num(tax_pct)},
    {sql_num(col(row, 48))}, {sql_num(col(row, 49))},
    {sql_date(col(row, 50))}, {sql_str(col(row, 51))},
    {sql_num(col(row, 55))}, {sql_num(col(row, 56))},
    {sql_date(col(row, 57))}, {sql_int(col(row, 58))},
    '{origin}', '{ir_type}', 'ACTIVE', false,
    NOW(), NOW()
);"""
        )

    print(f"  Generated {len(inserts)} inserts, skipped {skipped} empty rows")
    return inserts


# ── Main ──

def main():
    print("=" * 60)
    print("Mosaic ERP: Data Re-Import Script")
    print("=" * 60)

    # Decrypt workbook
    decrypted = decrypt_workbook(XLSB_PATH, PASSWORD)

    with open_workbook(decrypted) as wb:
        print(f"\nAvailable sheets: {wb.sheets}")

        # Generate all inserts
        direct_inserts = generate_direct_inserts(wb)
        outward_inserts = generate_outward_inserts(wb)
        slip_inserts = generate_slip_inserts(wb)
        inward_inserts = generate_inward_inserts(wb)

    # Write output files
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    files = [
        ('inserts_policies.sql', direct_inserts, 'Direct Insurance Contracts'),
        ('inserts_outward.sql', outward_inserts, 'Outward Reinsurance Cessions'),
        ('inserts_slips.sql', slip_inserts, 'Outward RE Slips'),
        ('inserts_inward.sql', inward_inserts, 'Inward Reinsurance Contracts'),
    ]

    print(f"\n{'=' * 60}")
    print("Writing output files...")
    print(f"{'=' * 60}")

    for filename, inserts, label in files:
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"-- {label}\n")
            f.write(f"-- Generated: {datetime.now().isoformat()}\n")
            f.write(f"-- Row count: {len(inserts)}\n\n")
            f.write("BEGIN;\n\n")
            for stmt in inserts:
                f.write(stmt + '\n\n')
            f.write("COMMIT;\n")
        print(f"  {filepath}: {len(inserts)} rows")

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Direct policies:     {len(direct_inserts):>6} rows")
    print(f"  Outward cessions:    {len(outward_inserts):>6} rows")
    print(f"  RE Slips:            {len(slip_inserts):>6} rows")
    print(f"  Inward reinsurance:  {len(inward_inserts):>6} rows")
    print(f"  TOTAL:               {sum(len(x) for _, x, _ in files):>6} rows")
    print(f"\nOutput directory: {OUTPUT_DIR}")
    print("Done!")


if __name__ == '__main__':
    main()
