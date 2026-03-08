
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Clean potential quotes that might come from .env parsing errors
const clean = (val: string | undefined): string => val?.replace(/["']/g, '').trim() || '';

// Environment configurations
const ENVIRONMENTS = {
  production: {
    url: clean(process.env.SUPABASE_URL),
    key: clean(process.env.SUPABASE_KEY),
  },
  staging: {
    url: clean(process.env.SUPABASE_STAGING_URL),
    key: clean(process.env.SUPABASE_STAGING_KEY),
  },
};

export type DbEnvironment = 'production' | 'staging';

const STORAGE_KEY = 'mosaic_db_environment';

/**
 * Get the current database environment from localStorage.
 * Defaults to 'production' if not set or if staging is not available.
 */
export function getDbEnvironment(): DbEnvironment {
  if (typeof window === 'undefined') return 'production';

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'staging' && ENVIRONMENTS.staging.url && ENVIRONMENTS.staging.key) {
    return 'staging';
  }
  return 'production';
}

/**
 * Set the database environment and reload the page to reinitialize the client.
 */
export function setDbEnvironment(env: DbEnvironment): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEY, env);
  window.location.reload();
}

/**
 * Check if staging environment credentials are configured.
 */
export function isStagingAvailable(): boolean {
  return !!(ENVIRONMENTS.staging.url && ENVIRONMENTS.staging.key);
}

/**
 * Get the current environment's Supabase URL (for display purposes).
 */
export function getCurrentSupabaseUrl(): string {
  const env = getDbEnvironment();
  return ENVIRONMENTS[env].url;
}

// Initialize Supabase client with the current environment's credentials
const currentEnv = getDbEnvironment();
const { url, key } = ENVIRONMENTS[currentEnv];

export const supabase: SupabaseClient | null = (url && key)
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: `mosaic_auth_${currentEnv}`,
      }
    })
  : null;
