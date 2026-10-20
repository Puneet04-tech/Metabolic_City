import { useCallback, useEffect, useRef, useState } from 'react';
import { clearSession, isAuthenticated, refreshSession } from '../api.js';

/** How long a session may sit idle before it is closed. */
export const IDLE_LIMIT_MS = 15 * 60 * 1000;
/** How long before that the "stay signed in" prompt appears. */
export const IDLE_WARNING_MS = 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'];
const ACTIVITY_THROTTLE_MS = 1000;

/**
 * Client-side inactivity guard.
 *
 * The server has no inactivity window: the access token lives 15 minutes and
 * the refresh token 7 days, and `POST /auth/refresh` rotates both. This guard
 * owns the idle window locally, warns one minute before it closes and lets
 * the user extend the session through the existing refresh flow.
 */
export function useInactivityGuard() {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(IDLE_WARNING_MS / 1000));

  const lastActivityRef = useRef(Date.now());
  const warningRef = useRef(false);
  const signedOutRef = useRef(false);

  const signOut = useCallback((reason) => {
    if (signedOutRef.current) return;
    signedOutRef.current = true;
    clearSession();
    const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`/login?error=${reason}&returnTo=${returnTo}`);
  }, []);

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (warningRef.current) return;
    setWarning(false);
  }, []);

  /** Extends the session: refreshes the tokens and restarts the idle window. */
  const staySignedIn = useCallback(async () => {
    const refreshed = await refreshSession();
    if (!refreshed) {
      signOut('session_expired');
      return false;
    }
    lastActivityRef.current = Date.now();
    warningRef.current = false;
    setWarning(false);
    return true;
  }, [signOut]);

  // Track activity. Events are throttled and ignored while the prompt is open
  // so the prompt cannot dismiss itself.
  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    let lastHandled = 0;
    const onActivity = () => {
      if (warningRef.current) return;
      const now = Date.now();
      if (now - lastHandled < ACTIVITY_THROTTLE_MS) return;
      lastHandled = now;
      markActive();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onActivity();
    };

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [markActive]);

  // Countdown to the idle limit.
  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    const tick = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;

      if (idleFor >= IDLE_LIMIT_MS) {
        signOut('inactivity');
        return;
      }

      if (idleFor >= IDLE_LIMIT_MS - IDLE_WARNING_MS) {
        warningRef.current = true;
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idleFor) / 1000)));
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [signOut]);

  return { warning, secondsLeft, staySignedIn, signOut: () => signOut('inactivity') };
}

export default useInactivityGuard;
