/**
 * Parses a search string into structured filters supporting:
 * - Plain text: broad search across all searchable fields
 * - column:value syntax: search a specific column
 * - Mixed: multiple terms are AND-ed together
 *
 * Examples:
 *   "Korindo"                    → [{ field: '_any', value: 'Korindo' }]
 *   "broker:Howden"              → [{ field: 'broker_name', value: 'Howden' }]
 *   "broker:Howden class:8.9"    → [{ field: 'broker_name', value: 'Howden' }, { field: 'class_of_business', value: '8.9' }]
 *   "broker:Howden Indonesia"    → [{ field: 'broker_name', value: 'Howden' }, { field: '_any', value: 'Indonesia' }]
 *   "Korindo Indonesia"          → [{ field: '_any', value: 'Korindo' }, { field: '_any', value: 'Indonesia' }]
 */

export interface SearchFilter {
  field: string;  // DB column name or '_any' for broad search
  value: string;
}

/** Maps user-facing shortcuts to v_portfolio column names */
const COLUMN_SHORTCUTS: Record<string, string> = {
  'class':     'class_of_business',
  'broker':    'broker_name',
  'cedant':    'cedant_name',
  'territory': 'territory',
  'terr':      'territory',
  'ref':       'reference_number',
  'slip':      'reference_number',
  'agreement': 'reference_number',
  'type':      'class_of_business',
  'currency':  'currency',
  'cur':       'currency',
  'insured':   'insured_name',
  'name':      'insured_name',
  'industry':  'source',           // closest available column
  'risk':      'reference_number', // closest available column
  'reinsurer': 'cedant_name',     // closest available column
  'status':    'status',
  'source':    'source',
};

/** All text columns in v_portfolio to search for broad (_any) queries */
export const BROAD_SEARCH_COLUMNS = [
  'reference_number',
  'insured_name',
  'broker_name',
  'cedant_name',
  'class_of_business',
  'territory',
  'currency',
  'status',
  'source',
];

export function parseSearchString(input: string): SearchFilter[] {
  if (!input || !input.trim()) return [];

  const filters: SearchFilter[] = [];
  // Split by spaces, but handle quoted values: column:"multi word"
  const rawTokens = tokenize(input.trim());

  // Merge tokens: if a token is "class:" (trailing colon, known shortcut)
  // and the next token has no colon, treat them as "class:nextToken".
  // This handles "class: 14" → "class:14"
  const tokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    if (t.endsWith(':') && t.length > 1) {
      const prefix = t.slice(0, -1).toLowerCase();
      if (COLUMN_SHORTCUTS[prefix] && i + 1 < rawTokens.length && !rawTokens[i + 1].includes(':')) {
        tokens.push(t + rawTokens[i + 1]);
        i++; // skip next token — consumed as value
        continue;
      }
    }
    tokens.push(t);
  }

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    if (colonIdx > 0) {
      const prefix = token.substring(0, colonIdx).toLowerCase();
      const value = token.substring(colonIdx + 1).replace(/^["']|["']$/g, '').trim();
      if (!value) continue;

      const dbColumn = COLUMN_SHORTCUTS[prefix];
      if (dbColumn) {
        filters.push({ field: dbColumn, value });
      } else {
        // Unknown prefix — treat as plain text broad search
        filters.push({ field: '_any', value: token });
      }
    } else {
      filters.push({ field: '_any', value: token });
    }
  }

  console.log('[SearchParser]', JSON.stringify({ input, filters }));
  return filters;
}

/**
 * Splits input by spaces, but keeps quoted segments together.
 * e.g. 'broker:"Willis Towers" class:8.9' → ['broker:"Willis Towers"', 'class:8.9']
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
        current += ch;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
    } else if (ch === ' ') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  return tokens;
}
