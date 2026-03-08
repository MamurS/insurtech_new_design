#!/usr/bin/env python3
"""Query OUTWARD records from database to see incorrectly imported data."""

import json
import os
import urllib.request

from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jwauzanxuwmwvvkojwmx.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

url = f"{SUPABASE_URL}/rest/v1/policies?recordType=eq.OUTWARD&limit=3"

req = urllib.request.Request(url)
req.add_header("apikey", SUPABASE_SERVICE_KEY)
req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_KEY}")
req.add_header("Content-Type", "application/json")

with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

if not data:
    print("No OUTWARD records found in database")
else:
    print(f"Found {len(data)} sample OUTWARD records:\n")
    for i, rec in enumerate(data):
        print(f"Record {i+1}:")
        for key in ["policyNumber", "insuredName", "brokerName", "currency", "territory",
                    "classOfInsurance", "typeOfInsurance", "slipNumber", "reinsurerName",
                    "accountingCode", "secondaryPolicyNumber",
                    "sumInsured", "grossPremium", "cededShare"]:
            val = rec.get(key)
            if val is not None and val != "":
                print(f"  {key}: {repr(val)[:80]}")
        print()
