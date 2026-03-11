import React, { useState } from 'react';
import { Database, ChevronDown } from 'lucide-react';
import { getDbEnvironment, setDbEnvironment, isStagingAvailable, DbEnvironment } from '../services/supabase';
import { useTheme } from '../theme/useTheme';

interface EnvironmentSwitcherProps {
  /** Compact mode for header placement */
  compact?: boolean;
}

/**
 * EnvironmentSwitcher allows users to switch between Production and Staging databases.
 * The page reloads when switching to reinitialize the Supabase client.
 */
const EnvironmentSwitcher: React.FC<EnvironmentSwitcherProps> = ({ compact = false }) => {
  const { t } = useTheme();
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
      dotStyle: { background: t.success } as React.CSSProperties,
      textStyle: { color: t.success } as React.CSSProperties,
    },
    staging: {
      label: 'Staging',
      dotStyle: { background: t.warning } as React.CSSProperties,
      textStyle: { color: t.warning } as React.CSSProperties,
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
              ? 'px-2 py-1.5 text-xs'
              : 'px-3 py-2 text-sm'
          }`}
          style={{ borderColor: t.border }}
        >
          <Database size={compact ? 14 : 16} style={{ color: t.text4 }} />
          <span className="flex items-center gap-1.5" style={current.textStyle}>
            <span className="w-2 h-2 rounded-full" style={current.dotStyle} />
            {current.label}
          </span>
          <ChevronDown
            size={compact ? 12 : 14}
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: t.text4 }}
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
            <div
              className="absolute right-0 mt-1 w-48 rounded-lg z-50 overflow-hidden"
              style={{ background: t.bgPanel, boxShadow: t.shadowMd, border: '1px solid ' + t.border }}
            >
              <div className="py-1">
                {/* Production Option */}
                <button
                  onClick={() => handleSelect('production')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                  style={{
                    background: currentEnv === 'production' ? t.successBg : undefined,
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.success }} />
                  <span className="flex-1" style={{ color: t.text2 }}>Production</span>
                  {currentEnv === 'production' && (
                    <span className="text-xs" style={{ color: t.success, fontWeight: 500 }}>Active</span>
                  )}
                </button>

                {/* Staging Option */}
                <button
                  onClick={() => stagingAvailable && handleSelect('staging')}
                  disabled={!stagingAvailable}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    !stagingAvailable ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{
                    background: stagingAvailable && currentEnv === 'staging' ? t.warningBg : undefined,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: stagingAvailable ? t.warning : t.text5 }}
                  />
                  <span
                    className="flex-1"
                    style={{ color: stagingAvailable ? t.text2 : t.text4 }}
                  >
                    Staging
                  </span>
                  {!stagingAvailable ? (
                    <span className="text-xs" style={{ color: t.text4 }}>Not configured</span>
                  ) : currentEnv === 'staging' ? (
                    <span className="text-xs" style={{ color: t.warning, fontWeight: 500 }}>Active</span>
                  ) : null}
                </button>
              </div>

              {!stagingAvailable && (
                <div
                  className="px-4 py-2 text-xs"
                  style={{ background: t.bgCard, borderTop: '1px solid ' + t.border, color: t.text4 }}
                >
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
          <div
            className="rounded-xl max-w-sm w-full mx-4 overflow-hidden"
            style={{ background: t.bgPanel, boxShadow: t.shadowLg }}
          >
            <div className="p-6">
              <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>
                Switch to {envConfig[showConfirm].label}?
              </h3>
              <p className="mt-2 text-sm" style={{ color: t.text3 }}>
                The page will reload to connect to the {showConfirm} database.
                {showConfirm === 'staging' && (
                  <span className="block mt-2" style={{ color: t.warning, fontWeight: 500 }}>
                    Changes in staging do not affect production data.
                  </span>
                )}
              </p>
            </div>
            <div
              className="flex gap-3 px-6 py-4"
              style={{ background: t.bgCard, borderTop: '1px solid ' + t.border }}
            >
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: t.text2, background: t.bgPanel, border: '1px solid ' + t.borderL, fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                className="flex-1 px-4 py-2 text-sm text-white rounded-lg transition-colors"
                style={{
                  background: showConfirm === 'staging' ? t.warning : t.success,
                  fontWeight: 500,
                }}
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
