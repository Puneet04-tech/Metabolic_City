import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { cellToBoundary } from 'h3-js';
import 'leaflet/dist/leaflet.css';
import { apiRequest, fetchStream, setSession, clearSession, getStoredUser } from './api.js';
import RequireAuth from './RequireAuth.jsx';
import { enqueueFieldUpdate, flushFieldOutbox } from './fieldOutbox.js';

const roleLabels = {
  OPERATOR: 'Dispatch Operator',
  FIELD_CREW: 'Field Crew',
  ADMINISTRATOR: 'Administrator',
};

const initialForm = {
  name: '',
  email: '',
  municipalityCode: '',
  opStaffId: '',
  opPassword: '',
  crewPhone: '',
  crewPasscode: '',
  adminId: '',
  adminToken: '',
};

const homeFor = (role) => (role === 'field_crew' ? '/field' : role === 'administrator' ? '/admin' : '/operator');

const lensLabels = {
  composite: 'Composite (Rc)',
  mobility: 'Mobility (Sm)',
  climate: 'Climate (Sc)',
  vulnerability: 'Vulnerability (Sv)',
};

const cellScore = (cell, mode) =>
  mode === 'composite' ? cell.compositeRisk : Number(cell.scores?.[mode]) || 0;

const cellBand = (value, threshold) => (value >= threshold ? 'critical' : value >= 4 ? 'warning' : 'normal');

function AuthForm() {
  const [mode, setMode] = useState('login');
  const [currentRole, setCurrentRole] = useState('OPERATOR');
  const [form, setForm] = useState(initialForm);
  const [alert, setAlert] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const errorParam = searchParams.get('error');
  useEffect(() => {
    if (!errorParam) return;
    const messages = {
      forbidden: 'Access denied: your role is not authorised for that console.',
      inactivity: 'Session expired after 15 minutes of inactivity. Please sign in again.',
      unauthorized: 'Authentication required. Please sign in to continue.',
    };
    setAlert({ message: messages[errorParam] || 'Your session could not be validated. Please sign in again.', type: 'error' });
  }, [errorParam]);

  const handleRoleSwitch = (role) => {
    setCurrentRole(role);
    setAlert({ message: '', type: '' });
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const showAlert = (message, type = 'error') => {
    setAlert({ message, type });
  };

  const buildPayload = () => {
    const cityCode = form.municipalityCode.trim();
    if (currentRole === 'OPERATOR') {
      return { cityCode, role: 'operator', staffId: form.opStaffId.trim(), password: form.opPassword };
    }
    if (currentRole === 'FIELD_CREW') {
      return { cityCode, role: 'field_crew', phone: form.crewPhone.trim(), password: form.crewPasscode.trim() };
    }
    return { cityCode, role: 'administrator', adminId: form.adminId.trim(), password: form.adminToken };
  };

  const activePassword =
    currentRole === 'OPERATOR' ? form.opPassword : currentRole === 'FIELD_CREW' ? form.crewPasscode : form.adminToken;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAlert({ message: '', type: '' });

    const cityCode = form.municipalityCode.trim();
    if (!cityCode) {
      showAlert('ERR_VALIDATION: Municipality / City Code is required.');
      return;
    }

    if (mode === 'signup' && (!form.name.trim() || !form.email.trim())) {
      showAlert('ERR_VALIDATION: Full name and email are required for signup.');
      return;
    }

    if (currentRole === 'OPERATOR' && (!form.opStaffId.trim() || !form.opPassword)) {
      showAlert(mode === 'signup' ? 'Operator ID and Password are required.' : 'Staff ID and Password are required.');
      return;
    }
    if (currentRole === 'FIELD_CREW' && (!form.crewPhone.trim() || !form.crewPasscode.trim())) {
      showAlert(mode === 'signup' ? 'Mobile number and password are required.' : 'Phone Number and Passcode are required.');
      return;
    }
    if (currentRole === 'ADMINISTRATOR' && (!form.adminId.trim() || !form.adminToken)) {
      showAlert(mode === 'signup' ? 'Administrator ID and Password are required.' : 'Administrator ID and Password are required.');
      return;
    }

    const passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d).{8,72}$/;
    if (!passwordPattern.test(activePassword)) {
      showAlert('Password must be 8-72 characters long and contain at least one letter and one number.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const payload = mode === 'signup' ? { name: form.name.trim(), email: form.email.trim(), ...buildPayload() } : buildPayload();

      const data = await apiRequest(endpoint, { method: 'POST', body: payload });

      setSession(data.token, data.user);
      showAlert(
        mode === 'signup' ? 'Account created successfully. Redirecting...' : 'Authentication successful. Redirecting...',
        'success'
      );
      setTimeout(() => navigate(homeFor(data.user.role)), 400);
    } catch (error) {
      showAlert(error.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    clearSession();
    navigate('/');
  };

  const signupFields = mode === 'signup' && (
    <>
      <div className="form-group">
        <label htmlFor="name">Full Name</label>
        <input id="name" name="name" type="text" value={form.name} onChange={handleFieldChange} placeholder="Enter full name" />
      </div>
      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input id="email" name="email" type="email" value={form.email} onChange={handleFieldChange} placeholder="name@municipality.gov" />
      </div>
    </>
  );

  return (
    <div className="page-shell">
      <div className="login-card">
        <div className="card-header">
          <div className="doc-badge">METABOLICCITY AI - V1 GATEWAY</div>
          <h1>Municipal Access Portal</h1>
          <p>Software-First Urban Intelligence Command System</p>
        </div>

        <div className="role-tabs">
          {Object.entries(roleLabels).map(([role, label]) => (
            <button key={role} type="button" className={currentRole === role ? 'tab-btn active' : 'tab-btn'} onClick={() => handleRoleSwitch(role)}>
              {label}
            </button>
          ))}
        </div>

        <div className="card-body">
          <div className="auth-mode-switch">
            <button type="button" className={mode === 'login' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('login')}>Login</button>
            <button type="button" className={mode === 'signup' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('signup')}>Sign Up</button>
          </div>

          {alert.message && <div className={`alert-banner ${alert.type || 'error'}`}>{alert.message}</div>}

          <div className="notice-box">
            <strong>Public Notice:</strong> Citizens do not log in here. Incident reports are ingested automatically via municipal hotlines and soft-sensing feeds.
          </div>

          <form id="loginForm" onSubmit={handleSubmit}>
            {signupFields}

            <div className="form-group">
              <label htmlFor="municipalityCode">Municipality / City Code</label>
              <input id="municipalityCode" name="municipalityCode" type="text" value={form.municipalityCode} onChange={handleFieldChange} placeholder="e.g. CITY-IND-BPL8" required />
            </div>

            {currentRole === 'OPERATOR' && (
              <>
                <div className="form-group">
                  <label htmlFor="opStaffId">Operator Console ID</label>
                  <input id="opStaffId" name="opStaffId" type="text" value={form.opStaffId} onChange={handleFieldChange} placeholder="e.g. OP-8842" />
                </div>
                <div className="form-group">
                  <label htmlFor="opPassword">Security Clearance Password</label>
                  <input id="opPassword" name="opPassword" type="password" value={form.opPassword} onChange={handleFieldChange} placeholder="8+ chars, letter + number" />
                </div>
              </>
            )}

            {currentRole === 'FIELD_CREW' && (
              <>
                <div className="form-group">
                  <label htmlFor="crewPhone">Registered Mobile Number</label>
                  <input id="crewPhone" name="crewPhone" type="tel" value={form.crewPhone} onChange={handleFieldChange} placeholder="+91 98765 43210" />
                </div>
                <div className="form-group">
                  <label htmlFor="crewPasscode">Password / Passcode</label>
                  <input id="crewPasscode" name="crewPasscode" type="password" value={form.crewPasscode} onChange={handleFieldChange} placeholder="8+ chars, letter + number" />
                </div>
              </>
            )}

            {currentRole === 'ADMINISTRATOR' && (
              <>
                <div className="form-group">
                  <label htmlFor="adminId">Administrator Account</label>
                  <input id="adminId" name="adminId" type="text" value={form.adminId} onChange={handleFieldChange} placeholder="e.g. ADM-SYS-01" />
                </div>
                <div className="form-group">
                  <label htmlFor="adminToken">Hardware Token / Password</label>
                  <input id="adminToken" name="adminToken" type="password" value={form.adminToken} onChange={handleFieldChange} placeholder="8+ chars, letter + number" />
                </div>
              </>
            )}

            <button type="submit" id="submitBtn" className="btn-submit" disabled={loading}>
              {loading
                ? mode === 'signup' ? 'Creating account...' : 'Authenticating...'
                : mode === 'signup' ? `Create ${roleLabels[currentRole]} Account` : 'Authenticate'}
            </button>
          </form>
        </div>

        <div className="card-footer">
          Deterministic Safety Logic & Audit Log Enabled<br />
          System Engine v1.0.4 - MongoDB Atlas Session Cluster
        </div>
      </div>
    </div>
  );
}

function ProductShell({ title, children }) {
  const user = getStoredUser();
  const navigate = useNavigate();
  const logout = async () => { try { await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* clear local session */ } clearSession(); navigate('/'); };

  const nav = [];
  if (['operator', 'administrator'].includes(user.role)) nav.push({ to: '/operator', label: 'Operator' });
  if (['field_crew', 'operator', 'administrator'].includes(user.role)) nav.push({ to: '/field', label: 'Field Crew' });
  if (user.role === 'administrator') nav.push({ to: '/admin', label: 'Admin' });
  if (['operator', 'administrator'].includes(user.role)) nav.push({ to: '/analytics', label: 'Analytics' });

  return (
    <main className="app-shell">
      <header className="app-bar">
        <div className="app-bar-brand">
          <span className="eyebrow">{user.cityCode}</span>
          <h1>{title}</h1>
        </div>
        {nav.length > 0 && (
          <nav className="app-nav">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{item.label}</NavLink>
            ))}
          </nav>
        )}
        <div className="app-user">
          <span>{user.name}</span>
          <span className="role-badge">{user.role}</span>
          <button type="button" onClick={logout} className={'btn-secondary'}>Sign out</button>
        </div>
      </header>
      {children}
    </main>
  );
}

function H3Map({ cells, mode, threshold, onSelect }) {
  const [node, setNode] = useState(null);
  useEffect(() => {
    if (!node) return undefined;
    const map = L.map(node).setView([23.2, 77.2], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const layers = cells.map((cell) => {
      const value = cellScore(cell, mode);
      const band = cellBand(value, threshold);
      const color = band === 'critical' ? '#c8392b' : band === 'warning' ? '#c58a00' : '#287c61';
      const polygon = L.polygon(cellToBoundary(cell.h3Index, true), { color, fillColor: color, fillOpacity: 0.42, weight: 2 }).addTo(map);
      polygon.bindTooltip(`${cell.h3Index} - ${lensLabels[mode]}: ${value.toFixed(2)}`);
      polygon.on('click', () => onSelect(cell));
      return polygon;
    });
    if (cells.length) map.fitBounds(L.latLngBounds(cells.flatMap((cell) => cellToBoundary(cell.h3Index, true))), { padding: [20, 20] });
    return () => { layers.forEach((layer) => layer.remove()); map.remove(); };
  }, [node, cells, mode, threshold, onSelect]);
  return <div className="map-canvas" ref={setNode} />;
}

function LiveCells({ cells, mode, threshold, onSelect }) {
  return (
    <div className="cell-grid">
      {cells.map((cell) => (
        <button type="button" key={cell.h3Index} onClick={() => onSelect(cell)} className={`cell-card ${cellBand(cellScore(cell, mode), threshold)}`}>
          <strong>{cell.h3Index}</strong>
          <span>{cellScore(cell, mode).toFixed(2)}</span>
          <small>Rc {cell.compositeRisk.toFixed(2)} · M {cell.scores.mobility.toFixed(1)} / C {cell.scores.climate.toFixed(1)} / V {cell.scores.vulnerability.toFixed(1)}{cell.isDegraded ? ' / DEGRADED' : ''}</small>
        </button>
      ))}
    </div>
  );
}

function useLiveCells(threshold = 7) {
  const [cells, setCells] = useState([]);
  const [connection, setConnection] = useState('connecting');

  useEffect(() => {
    const controller = new AbortController();
    const merge = (incoming) =>
      setCells((previous) => {
        const next = new Map(previous.map((cell) => [cell.h3Index, cell]));
        incoming.forEach((cell) => next.set(cell.h3Index, cell));
        return [...next.values()].sort((a, b) => b.compositeRisk - a.compositeRisk);
      });

    (async () => {
      try {
        const snapshot = await apiRequest('/v1/spatial-cells');
        merge(snapshot.cells || []);
        setConnection('live');
        await fetchStream('/v1/stream/h3', {
          signal: controller.signal,
          onMessage: (data) => {
            if (Array.isArray(data.cells) && data.cells.length) merge(data.cells);
          },
        });
      } catch {
        if (!controller.signal.aborted) setConnection('degraded');
      }
    })();

    return () => controller.abort();
  }, [threshold]);

  return { cells, connection };
}

function LensBars({ cell }) {
  const rows = [
    { key: 'mobility', label: 'S_m · Mobility', value: cell.scores.mobility },
    { key: 'climate', label: 'S_c · Climate', value: cell.scores.climate },
    { key: 'vulnerability', label: 'S_v · Vulnerability', value: cell.scores.vulnerability },
  ];
  return (
    <div className="lens-breakdown">
      {rows.map((row) => (
        <div className="lens-row" key={row.key}>
          <span className="lens-label">{row.label}</span>
          <span className="lens-track"><span className="lens-fill" style={{ width: `${(row.value / 10) * 100}%` }} /></span>
          <span className="lens-value">{row.value.toFixed(1)}</span>
        </div>
      ))}
      <p className="lens-formula">Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv)</p>
    </div>
  );
}

function LockTimer({ lock }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(lock.expiresAt) - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lock]);
  return <span className="lock-timer">Lock held · {remaining}s</span>;
}

function OperatorConsole() {
  const { cells, connection } = useLiveCells();
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('composite');
  const threshold = 7;

  const select = async (cell) => {
    setError('');
    if (cellScore(cell, 'composite') < threshold) {
      setNotice('This cell is below the critical threshold. No response directive is required.');
      return;
    }
    setSelected(cell);
    setNotice('');
    try {
      setAction(await apiRequest(`/v1/incidents/${cell.h3Index}/action`));
    } catch (e) {
      setError(e.message);
    }
  };

  const closeDrawer = () => { setSelected(null); setAction(null); };

  const lock = async () => {
    try {
      const result = await apiRequest(`/v1/incidents/${selected.h3Index}/lock`, { method: 'POST' });
      setAction((previous) => ({ ...previous, lock: result.lock }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const decide = async (decision) => {
    try {
      await apiRequest(`/v1/incidents/${selected.h3Index}/decision`, {
        method: 'POST',
        body: { decision, overrideReason: decision === 'override' ? 'Operator reviewed current evidence and declined dispatch.' : undefined },
      });
      setNotice(decision === 'approve' ? 'Alert approved. Field crew notified (task created for dispatch).' : 'Alert overridden and audited.');
      closeDrawer();
    } catch (e) {
      setError(e.message);
    }
  };

  const criticalCells = cells.filter((cell) => cell.compositeRisk >= threshold);

  return (
    <ProductShell title="Operator Command Console">
      <section className="console-layout">
        <div className="console-main">
          <div className="status-strip">
            <span className={`status-dot ${connection}`} /> Telemetry {connection}
            <span>{cells.length} active H3 cells</span>
            <span>{criticalCells.length} critical</span>
          </div>

          <div className="lens-toggle">
            <span className="lens-toggle-label">Lens filter</span>
            {Object.entries(lensLabels).map(([key, label]) => (
              <button key={key} type="button" className={mode === key ? 'lens-btn active' : 'lens-btn'} onClick={() => setMode(key)}>{label}</button>
            ))}
          </div>

          <div className="legend">
            <span className="legend-swatch critical" /> Critical (Rc &#8805; {threshold})
            <span className="legend-swatch warning" /> Caution (Rc &#8805; 4)
            <span className="legend-swatch normal" /> Normal (Rc &lt; 4)
          </div>

          <H3Map cells={cells} mode={mode} threshold={threshold} onSelect={select} />

          {criticalCells.length > 0 && (
            <div className="ticker" aria-label="Live critical alerts">
              <span className="ticker-label">PULSE</span>
              <div className="ticker-track">
                <div className="ticker-items">
                  {criticalCells.map((cell) => (
                    <button key={cell.h3Index} type="button" className="ticker-item" onClick={() => select(cell)}>
                      {cell.h3Index} · Rc {cell.compositeRisk.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {notice && <div className="alert-banner success">{notice}</div>}

          <LiveCells cells={cells} mode={mode} threshold={threshold} onSelect={select} />
        </div>

        <aside className="side-panel">
          <h2>Action drawer</h2>
          {!selected && <p>Select a critical red cell to review its response directive, lens breakdown and lock status.</p>}
          {selected && action && (
            <>
              <div className="panel-head">
                <span className="panel-title">{selected.h3Index}</span>
                {action.lock && <LockTimer lock={action.lock} />}
              </div>
              <div className="score-hero">
                <span>Composite Risk</span>
                <strong>{cellScore(selected, 'composite').toFixed(2)}</strong>
              </div>
              <LensBars cell={selected} />
              <div className="action-narrative">{action.action.actionNarrative}</div>
              <p><strong>Priority</strong><br />{action.action.priority}</p>
              <p><strong>Resources</strong><br />{action.action.recommendedResources.join(', ')}</p>
              <p><strong>Dispatch</strong><br />{action.action.dispatchText}</p>
              {error && <div className="alert-banner error">{error}</div>}
              {!action.lock ? (
                <button className="btn-submit" type="button" onClick={lock}>Claim 60-second lock</button>
              ) : (
                <>
                  <div className="button-stack">
                    <button className="btn-submit" type="button" onClick={() => decide('approve')}>Approve &amp; Dispatch</button>
                    <button className="btn-secondary" type="button" onClick={() => decide('override')}>Override Alert</button>
                  </div>
                  <button className="link-btn" type="button" onClick={closeDrawer}>Close drawer</button>
                </>
              )}
            </>
          )}
        </aside>
      </section>
    </ProductShell>
  );
}

function readPhotoAsThumbnail(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read photo.'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const MAX = 160;
        const scale = Math.min(1, MAX / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      image.onerror = () => reject(new Error('Could not decode photo.'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function FieldConsole() {
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiRequest('/v1/field/tasks')
      .then((data) => setTasks(data.incidents || []))
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const flush = () => flushFieldOutbox(apiRequest).then(load).catch(() => {});
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  const update = async (task, status, extras = {}) => {
    const update = { incidentId: task._id, status, ...extras };
    try {
      if (!navigator.onLine) throw new Error('offline');
      await apiRequest('/v1/field/sync', { method: 'POST', body: { updates: [update] } });
      setMessage(`Status synchronized: ${status}.`);
    } catch {
      await enqueueFieldUpdate(update);
      setMessage('Offline: status queued in the field outbox. It will sync when the network returns.');
    }
    setTasks((previous) => previous.map((item) => item._id === task._id ? { ...item, status, ...extras } : item));
  };

  const handleResolve = (task, note, photoDataUrl) => {
    const captureLocation = () => new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve([position.coords.latitude, position.coords.longitude]),
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
        <div className="field-banner">
          <span>Low-bandwidth mode</span>
          <strong className={navigator.onLine ? 'online' : 'offline'}>{navigator.onLine ? 'Online' : 'Offline'}</strong>
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

function TaskCard({ task, onUpdate, onResolve }) {
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [locating, setLocating] = useState(false);
  const resolved = task.status === 'RESOLVED';

  return (
    <article className="task-card large">
      <span className="eyebrow">{task.status}</span>
      <h2>H3 {task.h3Index}</h2>
      <p>Risk {task.riskScore} · {task.action?.recommendedResources?.join(', ')}</p>
      <p>{task.action?.dispatchText}</p>
      {task.resolutionNote && <p className="resolution-proof"><strong>Resolution note:</strong> {task.resolutionNote}</p>}
      {task.resolutionPhotoUrl && <img className="resolution-photo" src={task.resolutionPhotoUrl} alt="Resolution proof" />}
      {task.resolutionLatitude && task.resolutionLongitude && (
        <p className="resolution-proof"><strong>Resolved at:</strong> {task.resolutionLatitude.toFixed(5)}, {task.resolutionLongitude.toFixed(5)}</p>
      )}

      {!resolved && (
        <>
          {notesProgressive(task.status, onUpdate, task)}
          <div className="resolve-panel">
            <label htmlFor={`note-${task._id}`}>Resolution note</label>
            <textarea id={`note-${task._id}`} rows="2" maxLength="1000" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the clearance / mitigation performed" />
            <label className="photo-picker" htmlFor={`photo-${task._id}`}>
              {photoDataUrl ? 'Replace photo' : 'Attach geotagged photo proof'}
              <input id={`photo-${task._id}`} type="file" accept="image/*" capture="environment" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  setPhotoDataUrl(await readPhotoAsThumbnail(file));
                } catch (error) {
                  setLocating(false);
                  window.alert(error.message);
                }
              }} />
            </label>
            {photoDataUrl && <img className="resolution-photo" src={photoDataUrl} alt="Selected proof" />}
            <button
              className="btn-submit"
              type="button"
              disabled={!note.trim() && !photoDataUrl}
              onClick={() => { setLocating(true); onResolve(task, note.trim(), photoDataUrl).finally(() => setLocating(false)); }}
            >
              {locating ? 'Geotagging & submitting...' : 'Mark Completed + Resolve'}
            </button>
          </div>
        </>
      )}
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

function AdminConsole() {
  const [weights, setWeights] = useState({ Wm: 0.4, Wc: 0.4, Wv: 0.2 });
  const [threshold, setThreshold] = useState(7);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [preview, setPreview] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest('/v1/admin/weights'),
      apiRequest('/v1/admin/users'),
      apiRequest('/v1/analytics/summary'),
    ])
      .then(([weightData, userData, summary]) => {
        if (weightData.weights) setWeights(weightData.weights);
        if (Number.isFinite(weightData.threshold)) setThreshold(weightData.threshold);
        setUsers(userData.users || []);
        setAuditLogs(summary.auditLogs || []);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const sum = Number(weights.Wm) + Number(weights.Wc) + Number(weights.Wv);
  const dryRun = async () => {
    if (Math.abs(sum - 1) > 0.0001) return setMessage('Weights must sum to 1.00.');
    try {
      const result = await apiRequest('/v1/admin/weights/dry-run', { method: 'POST', body: weights });
      setPreview(result.preview || []);
      setMessage(`${result.preview.length} cells simulated with the proposed weights.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const save = async () => {
    if (Math.abs(sum - 1) > 0.0001) return setMessage('Weights must sum to 1.00.');
    try {
      await apiRequest('/v1/admin/weights', { method: 'PUT', body: { ...weights, threshold } });
      setMessage('Active weights and risk threshold saved. New telemetry will use them.');
      setPreview([]);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const toggleUser = async (user) => {
    try {
      await apiRequest(`/v1/admin/users/${user._id}/active`, { method: 'PATCH', body: { active: user.active === false } });
      setUsers((previous) => previous.map((item) => item._id === user._id ? { ...item, active: user.active === false } : item));
      setMessage(`User ${user.name} ${user.active === false ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const weightInput = (key) => (
    <label className="weight-row" key={key}>
      <span className="weight-name">{key}</span>
      <input type="range" min="0" max="1" step="0.01" value={Number(weights[key])} onChange={(event) => setWeights((previous) => ({ ...previous, [key]: Number(event.target.value) }))} />
      <input type="number" min="0" max="1" step="0.05" value={Number(weights[key])} onChange={(event) => setWeights((previous) => ({ ...previous, [key]: Number(event.target.value) }))} />
    </label>
  );

  return (
    <ProductShell title="Administration">
      {loading && <div className="empty-state">Loading administration console...</div>}
      {message && <p className="inline-message">{message}</p>}
      <section className="admin-grid">
        <article className="panel">
          <h2>Risk engine controls</h2>
          <p className="panel-sub">Deterministic formula: Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv). Weights must sum to 1.00.</p>
          {['Wm', 'Wc', 'Wv'].map(weightInput)}
          <p className="sum-readout">Sum <strong>{sum.toFixed(2)}</strong></p>

          <label className="weight-row">
            <span className="weight-name">Risk threshold (Rc)</span>
            <input type="range" min="4" max="9" step="0.5" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
            <input type="number" min="4" max="9" step="0.5" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
          </label>

          <div className="button-row">
            <button type="button" onClick={dryRun}>Dry run</button>
            <button className="btn-submit" type="button" onClick={save}>Save weights</button>
          </div>

          {preview.length > 0 && (
            <div className="preview-list">
              <h3>Dry-run projection</h3>
              {preview.map((row) => (
                <div className="preview-row" key={row.h3Index}>
                  <span>{row.h3Index}</span>
                  <span>{row.currentRisk.toFixed(2)} &#8594; <strong>{row.projectedRisk.toFixed(2)}</strong></span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>Municipal users</h2>
          {users.length === 0 ? <p className="panel-sub">No users in this jurisdiction yet.</p> : users.map((user) => (
            <div className="user-row" key={user._id}>
              <span><strong>{user.name}</strong><small>{user.role} · {user.email}</small></span>
              <span className="user-status">
                {user.active === false ? 'Disabled' : 'Active'}
                <button type="button" onClick={() => toggleUser(user)}>{user.active === false ? 'Enable' : 'Disable'}</button>
              </span>
            </div>
          ))}

          <h2>Audit trail</h2>
          <div className="table-list">
            {auditLogs.length === 0 ? <p className="panel-sub">No audit events logged yet.</p> : auditLogs.map((log) => (
              <div className="table-row" key={log._id}>
                <strong>{log.action}</strong>
                <span>{log.entityType}</span>
                <time>{new Date(log.createdAt).toLocaleString()}</time>
              </div>
            ))}
          </div>
        </article>
      </section>
    </ProductShell>
  );
}

function downloadCsv(filename, rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return 'n/a';
  if (ms < 1000) return `${ms} ms`;
  const minutes = ms / 60000;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
};

function Analytics() {
  const [data, setData] = useState({ counts: [], incidents: [], auditLogs: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    apiRequest('/v1/analytics/summary')
      .then(setData)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const withinRange = (iso) => {
    const time = new Date(iso).getTime();
    if (fromDate && time < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && time > new Date(`${toDate}T23:59:59`).getTime()) return false;
    return true;
  };

  const filteredIncidents = data.incidents.filter(
    (incident) => (!statusFilter || incident.status === statusFilter) && withinRange(incident.detectedAt)
  );
  const filteredAudits = data.auditLogs.filter((log) => withinRange(log.createdAt));

  const perDay = (() => {
    const counts = new Map();
    filteredIncidents.forEach((incident) => {
      const day = new Date(incident.detectedAt).toLocaleDateString();
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return [...counts.entries()].map(([day, count]) => ({ day, count }));
  })();
  const maxDay = Math.max(1, ...perDay.map((row) => row.count));

  const exportIncidents = () => {
    downloadCsv('incidents.csv', [
      ['h3Index', 'status', 'riskScore', 'detectedAt', 'resolvedAt', 'dispatchText'],
      ...filteredIncidents.map((incident) => [incident.h3Index, incident.status, incident.riskScore, new Date(incident.detectedAt).toISOString(), new Date(incident.resolvedAt || '').toISOString(), incident.action?.dispatchText || '']),
    ]);
  };

  const exportAudits = () => {
    downloadCsv('audit-trail.csv', [
      ['action', 'entityType', 'entityId', 'createdAt'],
      ...filteredAudits.map((log) => [log.action, log.entityType, log.entityId, new Date(log.createdAt).toISOString()]),
    ]);
  };

  const totalIncidents = filteredIncidents.length;
  const statusBreakdown = (() => {
    const counts = new Map();
    filteredIncidents.forEach((incident) => counts.set(incident.status, (counts.get(incident.status) || 0) + 1));
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  })();
  const avgRisk = filteredIncidents.length
    ? (filteredIncidents.reduce((acc, incident) => acc + Number(incident.riskScore) || acc, 0) / filteredIncidents.length).toFixed(2)
    : '0.00';

  return (
    <ProductShell title="Incident Analytics">
      <section className="analytics-grid">
        {loading && <div className="empty-state">Loading analytics...</div>}
        {error && <div className="alert-banner error">{error} <button className="link-btn" type="button" onClick={load}>Retry</button></div>}

        {!loading && !error && (
          <>
            <div className="analytics-toolbar">
              <label>Status
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All</option>
                  {data.counts.map((item) => <option key={item._id} value={item._id}>{item._id}</option>)}
                </select>
              </label>
              <label>From
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label>To
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
              <span className="toolbar-spacer" />
              <button type="button" onClick={exportIncidents} disabled={!filteredIncidents.length}>Export incidents (CSV)</button>
              <button type="button" onClick={exportAudits} disabled={!filteredAudits.length}>Export audit trail (CSV)</button>
            </div>

            <div className="metric-grid">
              <article className="metric"><span>Incidents (filtered)</span><strong>{totalIncidents}</strong><small>across {data.counts.length} statuses</small></article>
              <article className="metric"><span>Average risk</span><strong>{avgRisk}</strong><small>composite Rc</small></article>
              <article className="metric"><span>Resolution rate</span><strong>{data.metrics.resolutionRate ?? 0}%</strong><small>{data.metrics.resolved ?? 0} of {data.metrics.totalIncidents ?? 0} closed</small></article>
              <article className="metric"><span>Detection &#8594; approval</span><strong className="metric-duration">{formatDuration(data.metrics.avgDetectionToApprovalMs)}</strong><small>average response time</small></article>
              <article className="metric"><span>Approval &#8594; resolved</span><strong className="metric-duration">{formatDuration(data.metrics.avgApprovalToResolutionMs)}</strong><small>average resolution time</small></article>
              <article className="metric"><span>Dispatch &#8594; resolved</span><strong className="metric-duration">{formatDuration(data.metrics.avgDispatchToResolutionMs)}</strong><small>average field time</small></article>
              {data.counts.map((item) => (
                <article className="metric" key={item._id}>
                  <span>{item._id}</span>
                  <strong>{item.count}</strong>
                  <small>Avg risk {Number(item.averageRisk || 0).toFixed(2)}</small>
                </article>
              ))}
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="empty-state">No incidents match the current filters.</div>
            ) : (
              <>
                <article className="panel">
                  <h2>Incident history</h2>
                  {filteredIncidents.length === 0 && <p className="panel-sub">No incidents match the current filters.</p>}
                  <div className="table-list">
                    {filteredIncidents.map((incident) => (
                      <div className="table-row" key={incident._id}>
                        <strong>{incident.h3Index}</strong>
                        <span>{incident.status}</span>
                        <span>{incident.riskScore}</span>
                        <time>{new Date(incident.detectedAt).toLocaleString()}</time>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel">
                  <h2>Activity trend (incidents per day)</h2>
                  {perDay.length === 0 ? <p className="panel-sub">No incident activity in range.</p> : (
                    <div className="bar-chart">
                      {perDay.map((row) => (
                        <div className="bar-col" key={row.day}>
                          <div className="bar-fill" style={{ height: `${Math.max(6, (row.count / maxDay) * 100)}%` }} title={`${row.day}: ${row.count}`} />
                          <span className="bar-label">{row.count}</span>
                          <span className="bar-day">{row.day}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                {statusBreakdown.length > 0 && (
                  <article className="panel">
                    <h2>Status distribution</h2>
                    <div className="status-bars">
                      {statusBreakdown.map((row) => (
                        <div className="status-row" key={row.status}>
                          <span className="status-name">{row.status}</span>
                          <span className="status-track"><span className="status-fill" style={{ width: `${(row.count / Math.max(1, totalIncidents)) * 100}%` }} /></span>
                          <span className="status-count">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </>
            )}

            <article className="panel">
              <h2>Audit trail</h2>
              {filteredAudits.length === 0 ? <p className="panel-sub">No audit events in range.</p> : (
                <div className="table-list">
                  {filteredAudits.map((log) => (
                    <div className="table-row" key={log._id}>
                      <strong>{log.action}</strong>
                      <span>{log.entityType}</span>
                      <time>{new Date(log.createdAt).toLocaleString()}</time>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </ProductShell>
  );
}

function RoleHome() {
  const user = getStoredUser();
  const home = user.role ? homeFor(user.role) : '/';
  return <Navigate to={home} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthForm />} />
      <Route path="/operator" element={<RequireAuth roles={['operator']}><OperatorConsole /></RequireAuth>} />
      <Route path="/field" element={<RequireAuth roles={['field']}><FieldConsole /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminConsole /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth roles={['operator', 'admin']}><Analytics /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><RoleHome /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}