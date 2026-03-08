
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || process.env.SUPABASE_URL || ''),
      'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY || process.env.SUPABASE_KEY || ''),
      // Staging credentials (enables in-app environment switcher)
      'process.env.SUPABASE_STAGING_URL': JSON.stringify(env.SUPABASE_STAGING_URL || process.env.SUPABASE_STAGING_URL || ''),
      'process.env.SUPABASE_STAGING_KEY': JSON.stringify(env.SUPABASE_STAGING_KEY || process.env.SUPABASE_STAGING_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode)
    }
  };
});
