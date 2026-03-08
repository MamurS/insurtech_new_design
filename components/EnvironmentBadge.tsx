import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { getDbEnvironment, setDbEnvironment } from '../services/supabase';

/**
 * EnvironmentBadge displays a warning banner when connected to the staging environment.
 * Shows at the top of the app layout, only visible when environment is 'staging'.
 */
const EnvironmentBadge: React.FC = () => {
  const currentEnv = getDbEnvironment();

  // Only show when on staging
  if (currentEnv !== 'staging') {
    return null;
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>STAGING ENVIRONMENT — Changes here do not affect production data</span>
      </div>
      <button
        onClick={() => setDbEnvironment('production')}
        className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded transition-colors"
      >
        Switch to Production
      </button>
    </div>
  );
};

export default EnvironmentBadge;
