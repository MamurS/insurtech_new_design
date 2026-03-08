import React, { useState } from 'react';
import { Database, ChevronDown } from 'lucide-react';
import { getDbEnvironment, setDbEnvironment, isStagingAvailable, DbEnvironment } from '../services/supabase';

interface EnvironmentSwitcherProps {
  /** Compact mode for header placement */
  compact?: boolean;
}

/**
 * EnvironmentSwitcher allows users to switch between Production and Staging databases.
 * The page reloads when switching to reinitialize the Supabase client.
 */
const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<DbEnvironment | null>(null);

  const currentEnv = getDbEnvironment();
  const stagingAvailable = isStagingAvailable();

  const handleSelect = (env: DbEnvironment) => {
    if (env === currentEnv) {
      setIsOpen(false);
      return;
    }

    // Show confirmation dialog
    setShowConfirm(env);
    setIsOpen(false);
  };

  const confirmSwitch = () => {
    if (showConfirm) {
      setDbEnvironment(showConfirm);
      // Page will reload, no need to update state
    }
  };

  const envConfig = {
    production: {
      label: 'Production',
      dotColor: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
    },
    staging: {
      label: 'Staging',
      dotColor: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
    },
  };

  const current = envConfig[currentEnv];

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 rounded-lg border transition-colors ${
            compact
              ? 'px-2 py-1.5 text-xs border-slate-200 hover:bg-slate-50'
              : 'px-3 py-2 text-sm border-slate-300 hover:bg-slate-100'
          }`}
        >
          <Database size={compact ? 14 : 16} className="text-slate-500" />
          <span className={`flex items-center gap-1.5 ${current.textColor}`}>
            <span className={`w-2 h-2 rounded-full ${current.dotColor}`} />
            {current.label}
          </span>
          <ChevronDown
            size={compact ? 12 : 14}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden">
              <div className="py-1">
                {/* Production Option */}
                <button
                  onClick={() => handleSelect('production')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors ${
                    currentEnv === 'production' ? 'bg-emerald-50' : ''
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="flex-1 text-slate-700">Production</span>
                  {currentEnv === 'production' && (
                    <span className="text-xs text-emerald-600 font-medium">Active</span>
                  )}
                </button>

                {/* Staging Option */}
                <button
                  onClick={() => stagingAvailable && handleSelect('staging')}
                  disabled={!stagingAvailable}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    !stagingAvailable
                      ? 'opacity-50 cursor-not-allowed'
                      : currentEnv === 'staging'
                      ? 'bg-amber-50 hover:bg-amber-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${stagingAvailable ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <span className={`flex-1 ${stagingAvailable ? 'text-slate-700' : 'text-slate-400'}`}>
                    Staging
                  </span>
                  {!stagingAvailable ? (
                    <span className="text-xs text-slate-400">Not configured</span>
                  ) : currentEnv === 'staging' ? (
                    <span className="text-xs text-amber-600 font-medium">Active</span>
                  ) : null}
                </button>
              </div>

              {!stagingAvailable && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  Set SUPABASE_STAGING_URL and SUPABASE_STAGING_KEY in .env to enable staging.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-800">
                Switch to {envConfig[showConfirm].label}?
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                The page will reload to connect to the {showConfirm} database.
                {showConfirm === 'staging' && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    Changes in staging do not affect production data.
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  showConfirm === 'staging'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                Switch & Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EnvironmentSwitcher;
