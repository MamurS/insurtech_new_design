import React from 'react';
import { Clock, LogOut } from 'lucide-react';

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
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-amber-100">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">Session Expiring</h3>
              <p className="text-gray-600 leading-relaxed text-sm">
                Your session will expire in{' '}
                <span className="font-semibold text-amber-600">{timeDisplay}</span>{' '}
                due to inactivity. Click Continue to stay logged in.
              </p>
            </div>
          </div>

          {/* Countdown progress bar */}
          <div className="mt-4 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, (remainingSeconds / 120) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout Now
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            Continue Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutWarning;
