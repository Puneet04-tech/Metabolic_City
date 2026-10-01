import { useState, useEffect } from 'react';
import { apiRequest } from '../../api.js';
import { enqueueFieldUpdate, flushFieldOutbox } from '../../fieldOutbox.js';
import ProductShell from '../Shared/ProductShell.jsx';

function readPhotoAsThumbnail(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read photo.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 300;
        const scale = Math.min(maxSize / image.width, maxSize / image.height);
        canvas.width = image.width * scale;
        canvas.height = image.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      image.onerror = () => reject(new Error('Could not load image.'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function TaskCard({ task, onUpdate, onResolve }) {
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [locating, setLocating] = useState(false);
  const resolved = task.status === 'RESOLVED';

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const thumbnail = await readPhotoAsThumbnail(file);
      setPhotoDataUrl(thumbnail);
    } catch (error) {
      console.error('Photo error:', error);
    }
  };

  return (
    <article className={`task-card large ${task.status.toLowerCase()}`}>
      <div className="task-header">
        <h2>H3 {task.h3Index}</h2>
        <span className={`status-badge ${task.status.toLowerCase()}`}>{task.status}</span>
      </div>
      <div className="task-body">
        <p className="eyebrow">Risk {task.riskScore?.toFixed(1) || 'N/A'} · {task.action?.priority || 'N/A'}</p>
        <p className="dispatch-text">{task.action?.dispatchText || 'No dispatch text available.'}</p>
        {task.action?.actionNarrative && <p className="action-narrative">{task.action.actionNarrative}</p>}
        {!resolved && notesProgressive(task.status, onUpdate, task)}
        {!resolved && (
          <div className="resolve-panel">
            <label htmlFor={`note-${task._id}`}>Resolution note</label>
            <textarea
              id={`note-${task._id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Describe the clearance/mitigation performed"
              disabled={resolved}
            />
            <div className="photo-picker">
              <label htmlFor={`photo-${task._id}`} className="photo-btn">
                {photoDataUrl ? 'Change photo' : 'Attach geotagged photo proof'}
              </label>
              <input type="file" id={`photo-${task._id}`} accept="image/*" onChange={handlePhoto} />
              {photoDataUrl && <img src={photoDataUrl} alt="Proof" className="resolution-proof" />}
            </div>
            <button className="btn-submit" type="button" onClick={() => onResolve(task, note, photoDataUrl)} disabled={locating}>
              {locating ? 'Locating...' : 'Mark completed + resolve'}
            </button>
          </div>
        )}
        {resolved && (
          <div className="resolution-proof">
            <p><strong>Resolved at:</strong> {new Date(task.resolvedAt).toLocaleString()}</p>
            {task.resolutionNote && <p><strong>Note:</strong> {task.resolutionNote}</p>}
            {task.resolutionPhotoUrl && <img src={task.resolutionPhotoUrl} alt="Proof" />}
            {task.resolutionLatitude && task.resolutionLongitude && (
              <p><strong>Location:</strong> {task.resolutionLatitude.toFixed(6)}, {task.resolutionLongitude.toFixed(6)}</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function notesProgressive(status, onUpdate, task) {
  const buttons = ['ACKNOWLEDGED', 'ARRIVED'].filter((step) => status !== step);
  return (
    <div className="button-row">
      {buttons.map((step) => (
        <button key={step} type="button" onClick={() => onUpdate(task, step)}>{step === 'ACKNOWLEDGED' ? 'Acknowledge' : 'Arrived'}</button>
      ))}
    </div>
  );
}

function FieldConsole() {
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = () => {
    setLoading(true);
    apiRequest('/v1/field/tasks')
      .then((data) => {
        setTasks(data.incidents || []);
        setLastUpdated(new Date());
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const flush = () => flushFieldOutbox(apiRequest).then(load).catch(() => {});
    window.addEventListener('online', flush);
    return () => {
      window.removeEventListener('online', flush);
    };
  }, []);

  const update = async (task, status) => {
    try {
      await apiRequest('/v1/field/sync', {
        method: 'POST',
        body: { updates: [{ clientId: Date.now(), incidentId: task._id, status }] },
      });
      setTasks((previous) => previous.map((t) => (t._id === task._id ? { ...t, status } : t)));
    } catch (error) {
      if (error.message?.includes('offline')) {
        enqueueFieldUpdate({ incidentId: task._id, status });
        setTasks((previous) => previous.map((t) => (t._id === task._id ? { ...t, status } : t)));
      } else {
        setMessage(error.message);
      }
    }
  };

  const handleResolve = async (task, note, photoDataUrl) => {
    if (!note.trim()) return setMessage('Resolution note is required.');
    const captureLocation = () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) return resolve([undefined, undefined]);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => resolve([undefined, undefined]),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    return captureLocation().then(([latitude, longitude]) =>
      update(task, 'RESOLVED', { resolutionNote: note, resolutionPhotoUrl: photoDataUrl || undefined, latitude, longitude })
    );
  };

  return (
    <ProductShell title="Field Crew PWA">
      <section className="field-layout">
        <div className="field-header">
          <div className="field-banner">
            <span>Low-bandwidth mode</span>
            <strong className={navigator.onLine ? 'online' : 'offline'}>{navigator.onLine ? 'Online' : 'Offline'}</strong>
          </div>
          <div className="field-controls">
            <span className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</span>
            <button className="refresh-btn" onClick={load} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        {message && <p className="inline-message">{message}</p>}
        {loading ? (
          <div className="empty-state">Loading assigned tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">No assigned tasks. New approved alerts will appear here when an operator dispatches them.</div>
        ) : (
          tasks.map((task) => <TaskCard key={task._id} task={task} onUpdate={update} onResolve={handleResolve} />)
        )}
      </section>
    </ProductShell>
  );
}

export default FieldConsole;
