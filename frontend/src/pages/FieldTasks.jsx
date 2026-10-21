import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, RefreshCw } from 'lucide-react';
import AppShell from '../components/shell/AppShell/AppShell';
import MobileNav from '../components/Field/MobileNav';
import OfflineBanner from '../components/Field/OfflineBanner';
import TaskCard from '../components/Field/TaskCard';
import Button from '../components/ui/Button/Button';
import EmptyState from '../components/ui/EmptyState/EmptyState';
import ErrorState from '../components/ui/ErrorState/ErrorState';
import SegmentedControl from '../components/ui/SegmentedControl/SegmentedControl';
import Skeleton from '../components/ui/Skeleton/Skeleton';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import { cellCenter, distanceMeters } from '../lib/geo.js';
import { PRIORITY_ORDER } from '../lib/taskStatus.js';
import { getNavItems } from '../lib/routes.js';
import { getPendingFieldUpdates, flushFieldOutbox } from '../lib/fieldOutbox.js';
import styles from './FieldTasks.module.css';

const SORTS = [
  { value: 'priority', label: 'Priority' },
  { value: 'distance', label: 'Distance' },
];

export default function FieldTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [offline, setOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine));
  const [pending, setPending] = useState(0);
  const [position, setPosition] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const navigate = useNavigate();
  const user = getStoredUser();
  const navItems = useMemo(() => getNavItems(user.role), [user.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/v1/field/tasks');
      setTasks(data.incidents || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshPending = useCallback(async () => {
    setPending(await getPendingFieldUpdates());
  }, []);

  useEffect(() => {
    load();
    refreshPending();
  }, [load, refreshPending]);

  // Connectivity and the pending queue are part of the field state.
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // The crew's position is only requested when the distance sort is chosen.
  useEffect(() => {
    if (sortBy !== 'distance' || position) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (result) => setPosition({ lat: result.coords.latitude, lng: result.coords.longitude }),
      () => setPosition(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [sortBy, position]);

  const withDistance = useMemo(
    () =>
      tasks.map((task) => {
        const center = cellCenter(task.h3Index);
        return { task, center, distance: distanceMeters(position, center) };
      }),
    [tasks, position]
  );

  const sorted = useMemo(() => {
    const list = [...withDistance];
    if (sortBy === 'distance' && position) {
      list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      return list;
    }
    list.sort((a, b) => {
      const priority =
        PRIORITY_ORDER.indexOf(a.task.priority) - PRIORITY_ORDER.indexOf(b.task.priority);
      if (priority) return priority;
      return new Date(b.task.detectedAt || 0) - new Date(a.task.detectedAt || 0);
    });
    return list;
  }, [withDistance, sortBy, position]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const sent = await flushFieldOutbox(apiRequest);
      await refreshPending();
      if (sent) await load();
    } catch {
      setError('The queued updates could not be sent. They stay on this device.');
    } finally {
      setSyncing(false);
    }
  }, [load, refreshPending]);

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared either way */
    }
    clearSession();
    navigate('/');
  }, [navigate]);

  const openTask = useCallback((task) => navigate(`/field/tasks/${task._id}`), [navigate]);

  return (
    <AppShell
      title="Field tasks"
      cityCode={user.cityCode}
      user={user}
      navItems={navItems}
      onSignOut={handleSignOut}
    >
      <div className={styles.page}>
        <OfflineBanner offline={offline} pending={pending} onSync={sync} />

        <div className={styles.toolbar}>
          <SegmentedControl
            options={SORTS}
            value={sortBy}
            onChange={setSortBy}
            ariaLabel="Sort tasks"
          />
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            <RefreshCw size={13} aria-hidden="true" />
            Refresh
          </Button>
          <p className={styles.count}>
            {tasks.length} open task{tasks.length === 1 ? '' : 's'}
          </p>
        </div>

        {loading && !tasks.length ? (
          <div className={styles.list}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} height={132} />
            ))}
          </div>
        ) : null}

        {error ? <ErrorState title="Tasks could not be loaded" description={error} onRetry={load} /> : null}

        {!loading && !error && !tasks.length ? (
          <EmptyState
            icon={MapPin}
            title="No open tasks"
            description="Tasks appear here as soon as an operator approves an alert for your crew."
          />
        ) : null}

        {tasks.length ? (
          <div className={styles.list}>
            {sorted.map(({ task, distance }) => (
              <TaskCard key={task._id} task={task} distance={distance} onOpen={openTask} />
            ))}
          </div>
        ) : null}

        {syncing ? <p className={styles.syncing}>Sending queued updates…</p> : null}
      </div>

      <MobileNav navItems={navItems} onSignOut={handleSignOut} />
    </AppShell>
  );
}
