import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ExternalLink, MapPin } from 'lucide-react';
import AppShell from '../components/shell/AppShell/AppShell';
import MapSnippet from '../components/Field/MapSnippet';
import MobileNav from '../components/Field/MobileNav';
import OfflineBanner from '../components/Field/OfflineBanner';
import StatusStepper from '../components/Field/StatusStepper';
import Button from '../components/ui/Button/Button';
import ErrorState from '../components/ui/ErrorState/ErrorState';
import FormField from '../components/ui/FormField/FormField';
import Notice from '../components/ui/Notice/Notice';
import SeverityBadge from '../components/ui/SeverityBadge/SeverityBadge';
import Skeleton from '../components/ui/Skeleton/Skeleton';
import Textarea from '../components/ui/Textarea/Textarea';
import { Dialog, DialogContent } from '../components/ui/Dialog/Dialog';
import { useToast } from '../components/ui/Toast/Toast';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import { cellCenter, mapsUrl } from '../lib/geo.js';
import { actionLabelFor, nextStatusFor, priorityLabel, prioritySeverity, TASK_STATUSES } from '../lib/taskStatus.js';
import { getNavItems } from '../lib/routes.js';
import { enqueueFieldUpdate, flushFieldOutbox, getPendingFieldUpdates } from '../lib/fieldOutbox.js';
import styles from './FieldTaskDetail.module.css';

const readPhotoAsThumbnail = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The photo could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        const scale = Math.min(maxSize / image.width, maxSize / image.height);
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      image.onerror = () => reject(new Error('The photo could not be loaded.'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const currentPosition = () =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (result) => resolve({ latitude: result.coords.latitude, longitude: result.coords.longitude }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

export default function FieldTaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const user = getStoredUser();
  const navItems = useMemo(() => getNavItems(user.role), [user.role]);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(() => (typeof navigator === 'undefined' ? false : !navigator.onLine));
  const [pending, setPending] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const photoInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/v1/incidents/${id}`);
      setTask(data.incident);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    getPendingFieldUpdates().then(setPending);
  }, [load]);

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

  const center = useMemo(() => (task ? cellCenter(task.h3Index) : null), [task]);

  const sendUpdate = useCallback(
    async (status, extra = {}) => {
      if (!task) return;
      const previous = task;
      const clientId = crypto.randomUUID();

      setTask({ ...task, status });
      setSaving(true);

      const update = { clientId, incidentId: task._id, status, ...extra };
      const isOffline = offline || (typeof navigator !== 'undefined' && !navigator.onLine);

      try {
        if (isOffline) throw new Error('offline');
        await apiRequest('/v1/field/sync', { method: 'POST', body: { updates: [update] } });
        push('Task updated.', 'success');
      } catch (requestError) {
        if (requestError.message === 'offline' || isOffline) {
          await enqueueFieldUpdate(update);
          setPending(await getPendingFieldUpdates());
          push('Saved on this device. It will be sent when you are back online.', 'warning');
        } else {
          setTask(previous);
          push('The update could not be sent. The task was left unchanged.', 'error');
        }
      } finally {
        setSaving(false);
      }
    },
    [task, offline, push]
  );

  const advance = useCallback(() => {
    if (!task) return;
    const next = nextStatusFor(task.status);
    if (!next) return;
    if (next === 'RESOLVED') {
      setConfirmOpen(true);
      return;
    }
    sendUpdate(next);
  }, [task, sendUpdate]);

  const resolve = useCallback(async () => {
    setConfirmOpen(false);
    if (!note.trim()) {
      push('Add a short note describing what was done before resolving.', 'error');
      return;
    }
    const position = await currentPosition();
    await sendUpdate('RESOLVED', {
      resolutionNote: note.trim(),
      resolutionPhotoUrl: photo || undefined,
      ...position,
    });
    setNote('');
    setPhoto('');
  }, [note, photo, push, sendUpdate]);

  const attachPhoto = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await readPhotoAsThumbnail(file));
    } catch (photoError) {
      push(photoError.message, 'error');
    }
  }, [push]);

  const sync = useCallback(async () => {
    try {
      const sent = await flushFieldOutbox(apiRequest);
      setPending(await getPendingFieldUpdates());
      if (sent) {
        push(`${sent} queued update${sent === 1 ? '' : 's'} sent.`, 'success');
        load();
      }
    } catch {
      push('The queued updates could not be sent. They stay on this device.', 'error');
    }
  }, [load, push]);

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared either way */
    }
    clearSession();
    navigate('/');
  }, [navigate]);

  const actionLabel = task ? actionLabelFor(task.status) : null;

  return (
    <AppShell
      title="Field task"
      titleAs="span"
      cityCode={user.cityCode}
      user={user}
      navItems={navItems}
      onSignOut={handleSignOut}
    >
      <div className={styles.page}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/field')}>
          <ArrowLeft size={14} aria-hidden="true" />
          All tasks
        </Button>

        <OfflineBanner offline={offline} pending={pending} onSync={sync} />

        {loading ? (
          <div className={styles.skeleton}>
            <Skeleton height={28} width="60%" />
            <Skeleton height={120} />
            <Skeleton height={80} />
          </div>
        ) : null}

        {error ? <ErrorState title="This task could not be opened" description={error} onRetry={load} /> : null}

        {task ? (
          <article className={styles.task}>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>Incident</p>
                <h1 className={styles.title}>Cell {task.h3Index}</h1>
              </div>
              <SeverityBadge severity={prioritySeverity(task.priority)} label={priorityLabel(task.priority)} />
            </header>

            <StatusStepper status={task.status} />

            <section className={styles.section} aria-label="Directive">
              <h2 className={styles.sectionTitle}>Directive</h2>
              {task.action?.actionNarrative ? <p className={styles.narrative}>{task.action.actionNarrative}</p> : null}
              <p className={styles.instruction}>
                {task.action?.dispatchText || task.dispatchText || 'No instruction was attached to this task.'}
              </p>
              {task.action?.recommendedResources?.length ? (
                <p className={styles.resources}>
                  <span className={styles.resourceLabel}>Resources</span>
                  {task.action.recommendedResources.join(', ')}
                </p>
              ) : null}
            </section>

            <section className={styles.section} aria-label="Location">
              <h2 className={styles.sectionTitle}>Location</h2>
              <div className={styles.location}>
                <MapSnippet latitude={center?.lat} longitude={center?.lng} label={task.h3Index} />
                <div className={styles.locationMeta}>
                  <p className={styles.coordinates}>
                    <MapPin size={12} aria-hidden="true" />
                    {center ? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}` : 'Coordinates unavailable'}
                  </p>
                  {center ? (
                    <a className={styles.mapsLink} href={mapsUrl(center.lat, center.lng)} target="_blank" rel="noreferrer">
                      <ExternalLink size={13} aria-hidden="true" />
                      Open in Maps
                    </a>
                  ) : null}
                </div>
              </div>
            </section>

            {task.status !== 'RESOLVED' ? (
              <section className={styles.section} aria-label="Before you resolve">
                <h2 className={styles.sectionTitle}>Before you resolve</h2>
                <ul className={styles.checklist}>
                  <li data-done={note.trim() ? 'true' : 'false'}>Add a note describing what was done</li>
                  <li data-done={photo ? 'true' : 'false'}>Attach a photo of the site (optional)</li>
                  <li data-done="false">The app records where you were when you resolved it</li>
                </ul>

                <FormField label="Resolution note" hint="What did you find, and what did you do?">
                  {(props) => (
                    <Textarea
                      {...props}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="What did you find, and what did you do?"
                      rows={4}
                    />
                  )}
                </FormField>

                <div className={styles.photoPicker}>
                  <input
                    ref={photoInputRef}
                    id="resolution-photo"
                    className={styles.hiddenFile}
                    type="file"
                    accept="image/*"
                    onChange={attachPhoto}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => photoInputRef.current?.click()}
                    aria-describedby={photo ? 'resolution-photo-preview' : undefined}
                  >
                    <Camera size={14} aria-hidden="true" />
                    {photo ? 'Change photo' : 'Attach photo'}
                  </Button>
                  {photo ? (
                    <img
                      id="resolution-photo-preview"
                      className={styles.preview}
                      src={photo}
                      alt="Attached site photo"
                    />
                  ) : null}
                </div>
              </section>
            ) : (
              <Notice tone="success" title="Resolved">
                {task.resolutionNote || 'This task was closed by the crew.'}
              </Notice>
            )}

            <div className={styles.actions}>
              {actionLabel ? (
                <Button variant="primary" onClick={advance} loading={saving}>
                  {actionLabel}
                </Button>
              ) : (
                <Notice tone="success">This task is closed.</Notice>
              )}
            </div>

            {task.status && !actionLabel ? (
              <p className={styles.statusNote}>
                Status: {TASK_STATUSES[task.status]?.label ?? task.status}
              </p>
            ) : null}
          </article>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Resolve this task?"
          description="Resolving closes the incident and records the note, the photo and your position. It cannot be undone from the field app."
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Keep open
              </Button>
              <Button variant="primary" onClick={resolve}>
                Resolve task
              </Button>
            </>
          }
        >
          <p className={styles.confirmText}>
            The task will move to <strong>Resolved</strong> and the operator will see the closure.
          </p>
        </DialogContent>
      </Dialog>

      <MobileNav navItems={navItems} onSignOut={handleSignOut} />
    </AppShell>
  );
}
