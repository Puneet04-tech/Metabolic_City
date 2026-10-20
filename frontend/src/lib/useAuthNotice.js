import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Known sign-out / access codes and the message each one shows.
 * Unknown codes fall back to a safe generic message — raw query text is
 * never rendered.
 */
const NOTICES = {
  inactivity: {
    tone: 'warning',
    title: 'You were signed out',
    message: 'You were signed out due to inactivity. Log in to continue.',
  },
  forbidden: {
    tone: 'warning',
    title: 'Access denied',
    message: 'Your role does not have access to that area.',
  },
  session_expired: {
    tone: 'warning',
    title: 'Session expired',
    message: 'Your session expired. Log in to continue.',
  },
  unknown: {
    tone: 'error',
    title: 'Sign-in failed',
    message: 'We could not complete that request. Please try again.',
  },
};

export const AUTH_NOTICES = NOTICES;

/**
 * Reads `?error=` once, maps it to a known message and cleans the parameter
 * from the address bar with a replace navigation.
 */
export function useAuthNotice() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);

  const code = searchParams.get('error');

  useEffect(() => {
    if (!code) return;

    setNotice(NOTICES[code] ?? NOTICES.unknown);

    // Clean the parameter without leaving the current page — `returnTo` and
    // any other query parameters are preserved.
    const params = new URLSearchParams(searchParams);
    params.delete('error');
    const query = params.toString();
    navigate(`${window.location.pathname}${query ? `?${query}` : ''}`, { replace: true });
  }, [code, navigate, searchParams]);

  return notice;
}

export default useAuthNotice;
