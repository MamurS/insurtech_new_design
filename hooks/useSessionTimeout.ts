import { useState, useEffect, useCallback, useRef } from 'react';

const SESSION_STORAGE_KEY = 'insurtech_last_activity';
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000;   // Show warning 2 minutes before timeout
const THROTTLE_INTERVAL_MS = 30 * 1000;     // Check activity every 30 seconds

interface UseSessionTimeoutOptions {
  timeoutMs?: number;
  warningBeforeMs?: number;
  onTimeout: () => void;
  enabled?: boolean;
}

interface UseSessionTimeoutReturn {
  showWarning: boolean;
  remainingSeconds: number;
  continueSession: () => void;
  logoutNow: () => void;
}

export function useSessionTimeout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
  onTimeout,
  enabled = true,
}: UseSessionTimeoutOptions): UseSessionTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.floor(warningBeforeMs / 1000));
  const lastActivityRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Keep onTimeout ref current
  onTimeoutRef.current = onTimeout;

  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, String(now));
    } catch {
      // sessionStorage may be unavailable
    }
  }, []);

  const resetTimer = useCallback(() => {
    setShowWarning(false);
    setRemainingSeconds(Math.floor(warningBeforeMs / 1000));
    updateLastActivity();

    // Clear countdown if running
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [warningBeforeMs, updateLastActivity]);

  const continueSession = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const logoutNow = useCallback(() => {
    setShowWarning(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    onTimeoutRef.current();
  }, []);

  // Start countdown when warning is shown
  useEffect(() => {
    if (!showWarning) return;

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Time's up — auto-logout
          setShowWarning(false);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          onTimeoutRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [showWarning]);

  // Set up activity tracking and inactivity checking
  useEffect(() => {
    if (!enabled) return;

    // Initialize last activity
    updateLastActivity();

    // Throttled activity handler
    let lastThrottledUpdate = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastThrottledUpdate >= THROTTLE_INTERVAL_MS) {
        lastThrottledUpdate = now;
        lastActivityRef.current = now;
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, String(now));
        } catch {
          // sessionStorage may be unavailable
        }
      }
    };

    // Listen to user activity events
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Periodic check for inactivity
    checkIntervalRef.current = setInterval(() => {
      const lastActivity = lastActivityRef.current;
      const elapsed = Date.now() - lastActivity;
      const warningThreshold = timeoutMs - warningBeforeMs;

      if (elapsed >= timeoutMs) {
        // Already past timeout — logout immediately
        setShowWarning(false);
        onTimeoutRef.current();
      } else if (elapsed >= warningThreshold) {
        // In warning zone
        const msRemaining = timeoutMs - elapsed;
        setRemainingSeconds(Math.max(1, Math.ceil(msRemaining / 1000)));
        setShowWarning(true);
      }
    }, THROTTLE_INTERVAL_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [enabled, timeoutMs, warningBeforeMs, updateLastActivity]);

  return {
    showWarning,
    remainingSeconds,
    continueSession,
    logoutNow,
  };
}
