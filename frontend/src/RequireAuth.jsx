import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearSession, getStoredUser, isAuthenticated } from './api.js';
import { canAccess, getRoute } from './lib/routes.js';

/**
 * Route guard.
 *
 * - Not signed in  -> /login?returnTo=<current path>
 * - Wrong role     -> /unauthorized
 *
 * The allowed roles come from the shared route table, so the guard and the
 * navigation can never disagree.
 */
export default function RequireAuth({ routeId, children }) {
  const location = useLocation();
  const route = getRoute(routeId);
  const user = getStoredUser();

  // Inactivity sign-out. The 60-second "stay signed in" prompt is added in
  // the session-handling phase; the destination is already the login page.
  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    let timeoutId;
    const resetInactivityTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        clearSession();
        const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
        window.location.replace(`/login?error=inactivity&returnTo=${returnTo}`);
      }, 15 * 60 * 1000);
    };

    const events = ['click', 'keydown', 'pointerdown', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [location.pathname, location.search]);

  if (!isAuthenticated()) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (!canAccess(route, user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
