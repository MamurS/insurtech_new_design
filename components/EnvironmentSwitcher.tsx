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
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="transition-colors"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 8,
            border: '1px solid',
            borderColor: t.border,
            ...(compact
              ? { paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, fontSize: 12 }
              : { paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 14 }
            ),
          }}
        >
          <Database size={compact ? 14 : 16} style={{ color: t.text4 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, ...current.textStyle }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, ...current.dotStyle }} />
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
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <div
              style={{ position: 'absolute', right: 0, marginTop: 4, width: 192, borderRadius: 8, zIndex: 50, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowMd, border: '1px solid ' + t.border }}
            >
              <div style={{ paddingTop: 4, paddingBottom: 4 }}>
                {/* Production Option */}
                <button
                  onClick={() => handleSelect('production')}
                  className="transition-colors"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: 10,
                    paddingBottom: 10,
                    textAlign: 'left',
                    fontSize: 14,
                    background: currentEnv === 'production' ? t.successBg : undefined,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 9999, background: t.success }} />
                  <span style={{ flex: 1, color: t.text2 }}>Production</span>
                  {currentEnv === 'production' && (
                    <span style={{ fontSize: 12, color: t.success, fontWeight: 500 }}>Active</span>
                  )}
                </button>

                {/* Staging Option */}
                <button
                  onClick={() => stagingAvailable && handleSelect('staging')}
                  disabled={!stagingAvailable}
                  className="transition-colors"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    paddingLeft: 16,
                    paddingRight: 16,
                    paddingTop: 10,
                    paddingBottom: 10,
                    textAlign: 'left',
                    fontSize: 14,
                    background: stagingAvailable && currentEnv === 'staging' ? t.warningBg : undefined,
                    ...(!stagingAvailable ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
                  }}
                >
                  <span
                    style={{ width: 10, height: 10, borderRadius: 9999, background: stagingAvailable ? t.warning : t.text5 }}
                  />
                  <span
                    style={{ flex: 1, color: stagingAvailable ? t.text2 : t.text4 }}
                  >
                    Staging
                  </span>
                  {!stagingAvailable ? (
                    <span style={{ fontSize: 12, color: t.text4 }}>Not configured</span>
                  ) : currentEnv === 'staging' ? (
                    <span style={{ fontSize: 12, color: t.warning, fontWeight: 500 }}>Active</span>
                  ) : null}
                </button>
              </div>

              {!stagingAvailable && (
                <div
                  style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 12, background: t.bgCard, borderTop: '1px solid ' + t.border, color: t.text4 }}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div
            style={{ borderRadius: 12, maxWidth: 384, width: '100%', marginLeft: 16, marginRight: 16, overflow: 'hidden', background: t.bgPanel, boxShadow: t.shadowLg }}
          >
            <div style={{ padding: 24 }}>
              <h3 style={{ color: t.text1, fontSize: 15, fontWeight: 600 }}>
                Switch to {envConfig[showConfirm].label}?
              </h3>
              <p style={{ marginTop: 8, fontSize: 14, color: t.text3 }}>
                The page will reload to connect to the {showConfirm} database.
                {showConfirm === 'staging' && (
                  <span style={{ display: 'block', marginTop: 8, color: t.warning, fontWeight: 500 }}>
                    Changes in staging do not affect production data.
                  </span>
                )}
              </p>
            </div>
            <div
              style={{ display: 'flex', gap: 12, paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, background: t.bgCard, borderTop: '1px solid ' + t.border }}
            >
              <button
                onClick={() => setShowConfirm(null)}
                className="transition-colors"
                style={{ flex: 1, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 14, borderRadius: 8, color: t.text2, background: t.bgPanel, border: '1px solid ' + t.borderL, fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSwitch}
                className="transition-colors"
                style={{
                  flex: 1,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 8,
                  paddingBottom: 8,
                  fontSize: 14,
                  color: '#fff',
                  borderRadius: 8,
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
