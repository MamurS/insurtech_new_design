import * as XLSX from 'xlsx';

export interface ParsedBordereaux {
  totalGwp: number;
  totalPolicies: number;
  totalClaimsPaid: number;
  totalClaimsReserved: number;
  rowCount: number;
  fileName: string;
  detectedColumns: Record<string, string>; // our field → matched column name
}

// Patterns for auto-detecting column purpose from header text
const GWP_PATTERNS = ['premium', 'gwp', 'gross', 'written'];
const POLICY_PATTERNS = ['polic', 'count', 'risk', 'number of'];
const CLAIMS_PAID_PATTERNS = ['paid', 'settled'];
const CLAIMS_RESERVED_PATTERNS = ['reserve', 'outstanding', 'os', 'incurred'];

function matchHeader(header: string, patterns: string[]): boolean {
  const lower = header.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

function findColumn(headers: string[], patterns: string[]): string | null {
  return headers.find(h => matchHeader(h, patterns)) || null;
}

function sumNumericColumn(rows: Record<string, unknown>[], column: string): number {
  return rows.reduce((sum, row) => {
    const val = row[column];
    const num = typeof val === 'number' ? val : parseFloat(String(val || ''));
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}

function countOrSumColumn(rows: Record<string, unknown>[], column: string): number {
  // If all values are numeric, sum them; otherwise count non-empty rows
  let allNumeric = true;
  let sum = 0;
  let nonEmptyCount = 0;

  for (const row of rows) {
    const val = row[column];
    if (val === undefined || val === null || val === '') continue;
    nonEmptyCount++;
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) {
      allNumeric = false;
    } else {
      sum += num;
    }
  }

  return allNumeric && nonEmptyCount > 0 ? sum : nonEmptyCount;
}

export async function parseBordereaux(file: File): Promise<ParsedBordereaux> {
  const result: ParsedBordereaux = {
    totalGwp: 0,
    totalPolicies: 0,
    totalClaimsPaid: 0,
    totalClaimsReserved: 0,
    rowCount: 0,
    fileName: file.name,
    detectedColumns: {},
  };

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  if (wb.SheetNames.length === 0) return result;

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (rows.length === 0) return result;

  result.rowCount = rows.length;

  // Get header names from the first row's keys
  const headers = Object.keys(rows[0]);

  // Detect columns
  const gwpCol = findColumn(headers, GWP_PATTERNS);
  const policyCol = findColumn(headers, POLICY_PATTERNS);
  const claimsPaidCol = findColumn(headers, CLAIMS_PAID_PATTERNS);
  const claimsReservedCol = findColumn(headers, CLAIMS_RESERVED_PATTERNS);

  if (gwpCol) {
    result.detectedColumns.totalGwp = gwpCol;
    result.totalGwp = Math.round(sumNumericColumn(rows, gwpCol) * 100) / 100;
  }

  if (policyCol) {
    result.detectedColumns.totalPolicies = policyCol;
    result.totalPolicies = Math.round(countOrSumColumn(rows, policyCol));
  }

  if (claimsPaidCol) {
    result.detectedColumns.totalClaimsPaid = claimsPaidCol;
    result.totalClaimsPaid = Math.round(sumNumericColumn(rows, claimsPaidCol) * 100) / 100;
  }

  if (claimsReservedCol) {
    result.detectedColumns.totalClaimsReserved = claimsReservedCol;
    result.totalClaimsReserved = Math.round(sumNumericColumn(rows, claimsReservedCol) * 100) / 100;
  }

  return result;
}
