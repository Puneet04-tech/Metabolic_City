import StaySignedInDialog from './StaySignedInDialog';
import useInactivityGuard from '../../lib/useInactivityGuard.js';

/**
 * Mounted once for the whole app. Warns one minute before an idle session is
 * closed and lets the user extend it through the existing refresh flow.
 */
export default function SessionGuard() {
  const { warning, secondsLeft, staySignedIn, signOut } = useInactivityGuard();

  if (!warning) return null;

  return (
    <StaySignedInDialog
      open={warning}
      secondsLeft={secondsLeft}
      onStaySignedIn={staySignedIn}
      onSignOut={signOut}
    />
  );
}
