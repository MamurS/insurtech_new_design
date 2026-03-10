import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { getDbEnvironment, setDbEnvironment } from '../services/supabase';
import { useTheme } from '../theme/useTheme';

/**
 * EnvironmentBadge displays a warning banner when connected to the staging environment.
 * Shows at the top of the app layout, only visible when environment is 'staging'.
 */
const EnvironmentBadge: React.FC = () => {
  const { t } = useTheme();
  const currentEnv = getDbEnvironment();

  // Only show when on staging
  if (currentEnv !== 'staging') {
    return null;
  }

  return (
    <div className="px-4 py-2 flex items-center justify-between text-sm font-medium" style={{ background: t.warning, color: '#fff' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>STAGING ENVIRONMENT — Changes here do not affect production data</span>
      </div>
      <button
        onClick={() => setDbEnvironment('production')}
        className="text-xs px-3 py-1 rounded transition-colors"
        style={{ background: t.warning, color: '#fff' }}
      >
        Switch to Production
      </button>
    </div>
  );
};

export default EnvironmentBadge;
