import React from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface SessionTimeoutWarningProps {
  remainingSeconds: number;
  onContinue: () => void;
  onLogout: () => void;
}

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  remainingSeconds,
  onContinue,
  onLogout,
}) => {
  const { t } = useTheme();
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="rounded-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 border"
        style={{ background: t.bgPanel, boxShadow: t.shadowLg, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full" style={{ background: t.warningBg }}>
              <Clock className="w-6 h-6" style={{ color: t.warning }} />
            </div>
            <div className="flex-1">
              <h3 className="mb-1" style={{ color: t.text1, fontSize: 15, fontWeight: 700 }}>Session Expiring</h3>
              <p className="leading-relaxed text-sm" style={{ color: t.text3 }}>
                Your session will expire in{' '}
                <span style={{ color: t.warning, fontWeight: 600 }}>{timeDisplay}</span>{' '}
                due to inactivity. Click Continue to stay logged in.
              </p>
            </div>
          </div>

          {/* Countdown progress bar */}
          <div className="mt-4 w-full rounded-full h-1.5" style={{ background: t.bgHover }}>
            <div
              className="h-1.5 rounded-full transition-all duration-1000 ease-linear"
              style={{ background: t.warning, width: `${Math.min(100, (remainingSeconds / 120) * 100)}%` }}
            />
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end gap-3 border-t" style={{ background: t.bgCard, borderColor: t.border }}>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ color: t.text2, fontWeight: 500 }}
          >
            <LogOut size={16} />
            Logout Now
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ background: t.success, color: '#fff', boxShadow: t.shadow, fontWeight: 500 }}
          >
            Continue Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutWarning;
