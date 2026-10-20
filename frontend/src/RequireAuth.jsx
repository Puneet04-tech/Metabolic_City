import { Navigate, useLocation } from 'react-router-dom';
import { getStoredUser, isAuthenticated } from './api.js';
import { canAccess, getRoute } from './lib/routes.js';

/**
 * Route guard.
 *
 * - Not signed in  -> /login?returnTo=<current path>
 * - Wrong role     -> /unauthorized
 *
 * The allowed roles come from the shared route table, so the guard and the
 * navigation can never disagree. The idle window is owned by
 * `useInactivityGuard`, which is mounted once for the whole app.
 */
export default function RequireAuth({ routeId, children }) {
  const location = useLocation();
  const route = getRoute(routeId);
  const user = getStoredUser();

  if (!isAuthenticated()) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (!canAccess(route, user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
