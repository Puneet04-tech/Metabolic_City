import { Dialog, DialogContent } from '../ui/Dialog/Dialog';
import Button from '../ui/Button/Button';
import { useEffect, useState } from 'react';
import styles from './StaySignedInDialog.module.css';

/**
 * One-minute warning before an idle session is closed.
 * "Stay signed in" refreshes the session through the existing refresh flow.
 */
export default function StaySignedInDialog({ open, secondsLeft, onStaySignedIn, onSignOut }) {
  const [remaining, setRemaining] = useState(secondsLeft);

  useEffect(() => {
    setRemaining(secondsLeft);
  }, [secondsLeft]);

  useEffect(() => {
    if (!open) return undefined;
    const interval = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStaySignedIn?.()}>
      <DialogContent
        title="Are you still there?"
        description="Your session is closed after 15 minutes without activity."
        footer={
          <>
            <Button variant="ghost" onClick={onSignOut}>
              Sign out now
            </Button>
            <Button variant="primary" onClick={onStaySignedIn}>
              Stay signed in
            </Button>
          </>
        }
      >
        <p className={styles.countdown} aria-live="assertive">
          Signing out in <strong>{remaining} seconds</strong>
        </p>
      </DialogContent>
    </Dialog>
  );
}
