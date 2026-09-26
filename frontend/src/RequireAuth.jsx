import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { clearSession, getStoredUser, isAuthenticated } from './api.js';

const roleAliases = {
  operator: ['operator'],
  field: ['field', 'field_crew'],
  admin: ['admin', 'administrator'],
};

export default function RequireAuth({ children, roles = [] }) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const allowedRoles = roles.flatMap((role) => roleAliases[role] || role);

  useEffect(() => {
    if (!isAuthenticated()) return undefined;

    let timeoutId;
    const resetInactivityTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        clearSession();
        navigate('/?error=inactivity', { replace: true });
      }, 15 * 60 * 1000);
    };

    const events = ['click', 'keydown', 'pointerdown', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [navigate]);

  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/?error=forbidden" replace />;
  }

  return children;
}
