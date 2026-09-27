import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { cellToBoundary } from 'h3-js';
import 'leaflet/dist/leaflet.css';
import { apiRequest, setSession, clearSession, getStoredUser } from './api.js';
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

function AuthForm() {
  const [mode, setMode] = useState('login');
  const [currentRole, setCurrentRole] = useState('OPERATOR');
  const [form, setForm] = useState(initialForm);
  const [alert, setAlert] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    const base = { cityCode, role: currentRole.toLowerCase().replace('_', '') };

    if (currentRole === 'OPERATOR') {
      return { ...base, role: 'operator', staffId: form.opStaffId.trim(), password: form.opPassword };
    }
    if (currentRole === 'FIELD_CREW') {
      return { ...base, role: 'field_crew', phone: form.crewPhone.trim(), password: form.crewPasscode.trim() };
    }
    return { ...base, role: 'administrator', adminId: form.adminId.trim(), password: form.adminToken };
  };

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

    // Role-specific required checks.
    if (currentRole === 'OPERATOR' && (!form.opStaffId.trim() || !form.opPassword)) {
      showAlert(mode === 'signup' ? 'Operator ID and Password are required.' : 'Staff ID and Password are required.');
      return;
    }
    if (currentRole === 'FIELD_CREW' && (!form.crewPhone.trim() || !form.crewPasscode.trim())) {
      showAlert(mode === 'signup' ? 'Mobile number and password are required.' : 'Phone Number and PIN are required.');
      return;
    }
    if (currentRole === 'ADMINISTRATOR' && (!form.adminId.trim() || !form.adminToken)) {
      showAlert(mode === 'signup' ? 'Administrator ID and Password are required.' : 'Administrator ID and Token are required.');
      return;
    }

    // Enforce password policy on signup.
    if (mode === 'signup' && form.opPassword && form.opPassword.length < 8) {
      showAlert('Password must be at least 8 characters, with a letter and a number.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const payload = mode === 'signup' ? { name: form.name.trim(), email: form.email.trim(), ...buildPayload() } : buildPayload();

      const data = await apiRequest(endpoint, { method: 'POST', body: payload });

      setSession(data.token, data.user);
      showAlert(
        mode === 'signup' ? 'Account created successfully.' : 'Authentication successful.',
        'success'
      );
      setTimeout(() => navigate('/dashboard'), 400);
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
                  <input id="opPassword" name="opPassword" type="password" value={form.opPassword} onChange={handleFieldChange} placeholder="8+ characters" />
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
                  <label htmlFor="crewPasscode">SMS Gateway OTP / Passcode</label>
                  <input id="crewPasscode" name="crewPasscode" type="password" value={form.crewPasscode} onChange={handleFieldChange} placeholder="6-digit PIN" />
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
                  <input id="adminToken" name="adminToken" type="password" value={form.adminToken} onChange={handleFieldChange} placeholder="8+ characters" />
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

function Dashboard() {
  const user = getStoredUser();
  const navigate = useNavigate();
  const [cells, setCells] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [selectedCell, setSelectedCell] = useState(null);
  const [actionState, setActionState] = useState(null);
  const [actionError, setActionError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [fieldTasks, setFieldTasks] = useState([]);
  const [weights, setWeights] = useState({ Wm: 0.4, Wc: 0.4, Wv: 0.2 });
  const [weightMessage, setWeightMessage] = useState('');
  const isFieldCrew = user.role === 'field_crew';
  const isAdmin = user.role === 'administrator';

  useEffect(() => {
    let cancelled = false;
    let streamResponse;

    const loadLiveConsole = async () => {
      try {
        const snapshot = await apiRequest('/v1/spatial-cells');
        if (!cancelled) setCells(snapshot.cells || []);

        streamResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/v1/stream/h3`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('metabolic-city-token')}` },
          credentials: 'include',
        });
        if (!streamResponse.ok) throw new Error('Live stream unavailable.');
        if (!cancelled) setConnection('live');

        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';
          for (const message of messages) {
            const dataLine = message.split('\n').find((line) => line.startsWith('data: '));
            if (!dataLine) continue;
            const data = JSON.parse(dataLine.slice(6));
            if (Array.isArray(data.cells)) {
              setCells((previous) => {
                const next = new Map(previous.map((cell) => [cell.h3Index, cell]));
                data.cells.forEach((cell) => next.set(cell.h3Index, cell));
                return [...next.values()].sort((left, right) => right.compositeRisk - left.compositeRisk);
              });
            }
          }
        }
      } catch {
        if (!cancelled) setConnection('degraded');
      }
    };

    loadLiveConsole();
    return () => {
      cancelled = true;
      streamResponse?.body?.cancel();
    };
  }, []);

  useEffect(() => {
    const loadRoleData = async () => {
      try {
        if (isFieldCrew) {
          const response = await apiRequest('/v1/field/tasks');
          setFieldTasks(response.incidents || []);
          await flushFieldOutbox(apiRequest);
        }
        if (isAdmin) {
          const response = await apiRequest('/v1/admin/weights');
          setWeights(response.weights);
        }
      } catch (error) {
        setWeightMessage(error.message);
      }
    };
    loadRoleData();
    const flush = () => flushFieldOutbox(apiRequest).catch(() => {});
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [isFieldCrew, isAdmin]);

  const openActionDrawer = async (cell) => {
    if (cell.compositeRisk < 7 || !['operator', 'administrator'].includes(user.role)) return;
    setSelectedCell(cell);
    setActionError('');
    try {
      setActionState(await apiRequest(`/v1/incidents/${cell.h3Index}/action`));
    } catch (error) {
      setActionError(error.message);
    }
  };

  const acquireLock = async () => {
    try {
      const result = await apiRequest(`/v1/incidents/${selectedCell.h3Index}/lock`, { method: 'POST' });
      setActionState((previous) => ({ ...previous, lock: result.lock }));
      setActionError('');
    } catch (error) {
      setActionError(error.message);
    }
  };

  const decideIncident = async (decision) => {
    setDecisionLoading(true);
    try {
      await apiRequest(`/v1/incidents/${selectedCell.h3Index}/decision`, {
        method: 'POST',
        body: { decision, overrideReason: decision === 'override' ? 'Operator reviewed current evidence and declined dispatch.' : undefined },
      });
      setSelectedCell(null);
      setActionState(null);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setDecisionLoading(false);
    }
  };

  const updateFieldTask = async (incidentId, status) => {
    const update = { incidentId, status };
    try {
      if (!navigator.onLine) throw new Error('offline');
      await apiRequest('/v1/field/sync', { method: 'POST', body: { updates: [update] } });
    } catch {
      await enqueueFieldUpdate(update);
    }
    setFieldTasks((previous) => previous.map((task) => task._id === incidentId ? { ...task, status } : task));
  };

  const saveWeights = async (dryRun = false) => {
    const total = Number(weights.Wm) + Number(weights.Wc) + Number(weights.Wv);
    if (Math.abs(total - 1) > 0.0001) {
      setWeightMessage('Weights must sum exactly to 1.');
      return;
    }
    try {
      const endpoint = dryRun ? '/v1/admin/weights/dry-run' : '/v1/admin/weights';
      const response = await apiRequest(endpoint, { method: dryRun ? 'POST' : 'PUT', body: weights });
      setWeightMessage(dryRun ? `Dry run generated ${response.preview.length} projected cells.` : 'Weights saved. New telemetry will use them.');
    } catch (error) {
      setWeightMessage(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors; clear local session regardless
    }
    clearSession();
    navigate('/');
  };

  return (
    <div className="dashboard-shell">
      <div className="dashboard-card">
        <h2>Metabolic City Dashboard</h2>
        <p>Welcome, {user.name || 'Operator'}.</p>
        <p>Role: {user.role || 'operator'}</p>
        <p>City: {user.cityCode || 'N/A'}</p>
        <p>Telemetry stream: <strong>{connection}</strong></p>
        {isFieldCrew && <section className="phase-panel">
          <h3>Field Crew Tasks</h3>
          {fieldTasks.length === 0 ? <p>No assigned field tasks.</p> : fieldTasks.map((task) => (
            <article className="task-card" key={task._id}>
              <strong>{task.h3Index}</strong><span>Risk {task.riskScore}</span>
              <small>{task.action?.dispatchText}</small>
              <div className="task-actions">
                <button type="button" onClick={() => updateFieldTask(task._id, 'ACKNOWLEDGED')}>Acknowledge</button>
                <button type="button" onClick={() => updateFieldTask(task._id, 'ARRIVED')}>Arrived</button>
                <button type="button" onClick={() => updateFieldTask(task._id, 'RESOLVED')}>Resolved</button>
              </div>
            </article>
          ))}
        </section>}
        {isAdmin && <section className="phase-panel">
          <h3>Risk Weight Tuning</h3>
          {['Wm', 'Wc', 'Wv'].map((key) => <label className="weight-row" key={key}>{key}
            <input type="number" min="0" max="1" step="0.05" value={weights[key]} onChange={(event) => setWeights((previous) => ({ ...previous, [key]: Number(event.target.value) }))} />
          </label>)}
          <p>Sum: {(Number(weights.Wm) + Number(weights.Wc) + Number(weights.Wv)).toFixed(2)}</p>
          {weightMessage && <p>{weightMessage}</p>}
          <div className="task-actions"><button type="button" onClick={() => saveWeights(true)}>Dry Run</button><button type="button" onClick={() => saveWeights(false)}>Save Weights</button></div>
        </section>}
        <h3>Live H3 Risk Cells</h3>
        {cells.length === 0 ? <p>No telemetry has been received for this jurisdiction.</p> : (
          <div className="cell-list">
            {cells.map((cell) => (
                <article role={cell.compositeRisk >= 7 ? 'button' : undefined} tabIndex={cell.compositeRisk >= 7 ? 0 : undefined} onClick={() => openActionDrawer(cell)} className={`risk-cell risk-${cell.compositeRisk >= 7 ? 'critical' : cell.compositeRisk >= 4 ? 'warning' : 'normal'}`} key={cell.h3Index}>
                <strong>{cell.h3Index}</strong>
                <span>Risk {cell.compositeRisk.toFixed(2)}</span>
                <small>M {cell.scores.mobility.toFixed(1)} / C {cell.scores.climate.toFixed(1)} / V {cell.scores.vulnerability.toFixed(1)}</small>
                {cell.isDegraded && <small>DEGRADED_DATA</small>}
              </article>
            ))}
          </div>
        )}
        {selectedCell && actionState && (
          <aside className="action-drawer">
            <div className="drawer-heading">
              <h3>Critical Cell Action</h3>
              <button type="button" onClick={() => setSelectedCell(null)} aria-label="Close action drawer">Close</button>
            </div>
            <p><strong>{selectedCell.h3Index}</strong> · Risk {selectedCell.compositeRisk.toFixed(2)}</p>
            <p>{actionState.action.actionNarrative}</p>
            <p><strong>Resources:</strong> {actionState.action.recommendedResources.join(', ')}</p>
            <p><strong>Dispatch:</strong> {actionState.action.dispatchText}</p>
            {actionError && <div className="alert-banner error">{actionError}</div>}
            {!actionState.lock ? (
              <button type="button" className="btn-submit" onClick={acquireLock}>Claim 60-second operator lock</button>
            ) : (
              <div className="drawer-actions">
                <button type="button" className="btn-submit" disabled={decisionLoading} onClick={() => decideIncident('approve')}>Approve &amp; Dispatch</button>
                <button type="button" className="btn-secondary" disabled={decisionLoading} onClick={() => decideIncident('override')}>Override Alert</button>
              </div>
            )}
          </aside>
        )}
        {actionError && !selectedCell && <div className="alert-banner error">{actionError}</div>}
        <button type="button" className="btn-submit" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}

function ProductShell({ title, children }) {
  const user = getStoredUser();
  const navigate = useNavigate();
  const logout = async () => { try { await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* clear local session */ } clearSession(); navigate('/'); };
  return <main className="app-shell"><header className="app-bar"><div><span className="eyebrow">{user.cityCode}</span><h1>{title}</h1></div><div className="app-user"><span>{user.name}</span><button type="button" onClick={logout}>Sign out</button></div></header>{children}</main>;
}

function H3Map({ cells, onSelect }) {
  const [node, setNode] = useState(null);
  useEffect(() => {
    if (!node) return undefined;
    const map = L.map(node).setView([23.2, 77.2], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const layers = cells.map((cell) => {
      const color = cell.compositeRisk >= 7 ? '#c8392b' : cell.compositeRisk >= 4 ? '#c58a00' : '#287c61';
      const polygon = L.polygon(cellToBoundary(cell.h3Index, true), { color, fillColor: color, fillOpacity: 0.42, weight: 2 }).addTo(map);
      polygon.bindTooltip(`Risk ${cell.compositeRisk.toFixed(2)}`); polygon.on('click', () => onSelect(cell)); return polygon;
    });
    if (cells.length) map.fitBounds(L.latLngBounds(cells.flatMap((cell) => cellToBoundary(cell.h3Index, true))), { padding: [20, 20] });
    return () => { layers.forEach((layer) => layer.remove()); map.remove(); };
  }, [node, cells, onSelect]);
  return <div className="map-canvas" ref={setNode} />;
}

function LiveCells({ cells, onSelect }) { return <div className="cell-grid">{cells.map((cell) => <button type="button" key={cell.h3Index} onClick={() => onSelect(cell)} className={`cell-card ${cell.compositeRisk >= 7 ? 'critical' : cell.compositeRisk >= 4 ? 'warning' : ''}`}><strong>{cell.h3Index}</strong><span>{cell.compositeRisk.toFixed(2)}</span><small>M {cell.scores.mobility.toFixed(1)} / C {cell.scores.climate.toFixed(1)} / V {cell.scores.vulnerability.toFixed(1)}{cell.isDegraded ? ' / DEGRADED' : ''}</small></button>)}</div>; }

function useLiveCells() {
  const [cells, setCells] = useState([]); const [connection, setConnection] = useState('connecting');
  useEffect(() => { let stopped = false; let response;
    (async () => { try { const snapshot = await apiRequest('/v1/spatial-cells'); if (!stopped) setCells(snapshot.cells || []); response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/v1/stream/h3`, { headers: { Authorization: `Bearer ${sessionStorage.getItem('metabolic-city-token')}` }, credentials: 'include' }); if (!response.ok) throw new Error('stream unavailable'); setConnection('live'); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; while (!stopped) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value); const messages = buffer.split('\n\n'); buffer = messages.pop() || ''; messages.forEach((message) => { const line = message.split('\n').find((item) => item.startsWith('data: ')); if (!line) return; const data = JSON.parse(line.slice(6)); if (data.cells) setCells((previous) => { const next = new Map(previous.map((cell) => [cell.h3Index, cell])); data.cells.forEach((cell) => next.set(cell.h3Index, cell)); return [...next.values()].sort((a, b) => b.compositeRisk - a.compositeRisk); }); }); } } catch { if (!stopped) setConnection('degraded'); } })(); return () => { stopped = true; response?.body?.cancel(); }; }, []); return { cells, connection };
}

function OperatorConsole() {
  const { cells, connection } = useLiveCells(); const [selected, setSelected] = useState(null); const [action, setAction] = useState(null); const [error, setError] = useState('');
  const select = async (cell) => { if (cell.compositeRisk < 7) return; setSelected(cell); try { setAction(await apiRequest(`/v1/incidents/${cell.h3Index}/action`)); } catch (e) { setError(e.message); } };
  const lock = async () => { try { const result = await apiRequest(`/v1/incidents/${selected.h3Index}/lock`, { method: 'POST' }); setAction((previous) => ({ ...previous, lock: result.lock })); } catch (e) { setError(e.message); } };
  const decide = async (decision) => { try { await apiRequest(`/v1/incidents/${selected.h3Index}/decision`, { method: 'POST', body: { decision } }); setSelected(null); setAction(null); } catch (e) { setError(e.message); } };
  return <ProductShell title="Operator Command Console"><section className="console-layout"><div className="console-main"><div className="status-strip"><span className={`status-dot ${connection}`} /> Telemetry {connection}<span>{cells.length} active H3 cells</span></div><H3Map cells={cells} onSelect={select} /><LiveCells cells={cells} onSelect={select} /></div><aside className="side-panel"><h2>Action drawer</h2>{!selected && <p>Select a critical red cell to review its response directive.</p>}{selected && action && <><div className="score-hero"><span>Composite Risk</span><strong>{selected.compositeRisk.toFixed(2)}</strong></div><p>{action.action.actionNarrative}</p><p><strong>Resources</strong><br />{action.action.recommendedResources.join(', ')}</p><p><strong>Dispatch</strong><br />{action.action.dispatchText}</p>{error && <div className="alert-banner error">{error}</div>}{!action.lock ? <button className="btn-submit" type="button" onClick={lock}>Claim 60-second lock</button> : <div className="button-stack"><button className="btn-submit" type="button" onClick={() => decide('approve')}>Approve &amp; Dispatch</button><button className="btn-secondary" type="button" onClick={() => decide('override')}>Override Alert</button></div>}</>}</aside></section></ProductShell>;
}

function FieldConsole() {
  const [tasks, setTasks] = useState([]); const [message, setMessage] = useState('');
  useEffect(() => { apiRequest('/v1/field/tasks').then((data) => setTasks(data.incidents || [])).catch((error) => setMessage(error.message)); const flush = () => flushFieldOutbox(apiRequest).catch(() => {}); window.addEventListener('online', flush); return () => window.removeEventListener('online', flush); }, []);
  const update = async (task, status) => { const data = { incidentId: task._id, status }; try { if (!navigator.onLine) throw new Error('offline'); await apiRequest('/v1/field/sync', { method: 'POST', body: { updates: [data] } }); setMessage('Status synchronized.'); } catch { await enqueueFieldUpdate(data); setMessage('Offline: status queued.'); } setTasks((previous) => previous.map((item) => item._id === task._id ? { ...item, status } : item)); };
  return <ProductShell title="Field Crew PWA"><section className="field-layout"><div className="field-banner"><span>Low-bandwidth mode</span><strong>{navigator.onLine ? 'Online' : 'Offline'}</strong></div>{message && <p className="inline-message">{message}</p>}{tasks.length === 0 ? <div className="empty-state">No assigned tasks.</div> : tasks.map((task) => <article className="task-card large" key={task._id}><span className="eyebrow">{task.status}</span><h2>H3 {task.h3Index}</h2><p>Risk {task.riskScore} · {task.action?.recommendedResources?.join(', ')}</p><p>{task.action?.dispatchText}</p><div className="button-row"><button type="button" onClick={() => update(task, 'ACKNOWLEDGED')}>Acknowledge</button><button type="button" onClick={() => update(task, 'ARRIVED')}>Arrived</button><button type="button" onClick={() => update(task, 'RESOLVED')}>Resolved</button></div></article>)}</section></ProductShell>;
}

function AdminConsole() {
  const [weights, setWeights] = useState({ Wm: 0.4, Wc: 0.4, Wv: 0.2 }); const [users, setUsers] = useState([]); const [message, setMessage] = useState('');
  useEffect(() => { Promise.all([apiRequest('/v1/admin/weights'), apiRequest('/v1/admin/users')]).then(([weightData, userData]) => { setWeights(weightData.weights); setUsers(userData.users || []); }).catch((error) => setMessage(error.message)); }, []);
  const save = async (dryRun) => { if (Math.abs(weights.Wm + weights.Wc + weights.Wv - 1) > 0.0001) return setMessage('Weights must sum to 1.00.'); try { const result = await apiRequest(`/v1/admin/weights${dryRun ? '/dry-run' : ''}`, { method: dryRun ? 'POST' : 'PUT', body: weights }); setMessage(dryRun ? `${result.preview.length} cells simulated.` : 'Active weights saved.'); } catch (error) { setMessage(error.message); } };
  return <ProductShell title="Administration"><section className="admin-grid"><article className="panel"><h2>Risk engine controls</h2>{['Wm', 'Wc', 'Wv'].map((key) => <label className="weight-row" key={key}>{key}<input type="number" step="0.05" min="0" max="1" value={weights[key]} onChange={(event) => setWeights((previous) => ({ ...previous, [key]: Number(event.target.value) }))} /></label>)}<p>Sum {(weights.Wm + weights.Wc + weights.Wv).toFixed(2)}</p><div className="button-row"><button type="button" onClick={() => save(true)}>Dry run</button><button className="btn-submit" type="button" onClick={() => save(false)}>Save weights</button></div>{message && <p className="inline-message">{message}</p>}</article><article className="panel"><h2>Municipal users</h2>{users.map((user) => <div className="user-row" key={user._id}><span><strong>{user.name}</strong><small>{user.role} · {user.email}</small></span><span>{user.active === false ? 'Disabled' : 'Active'}</span></div>)}</article></section></ProductShell>;
}

function Analytics() { const [data, setData] = useState({ counts: [], incidents: [], auditLogs: [] }); useEffect(() => { apiRequest('/v1/analytics/summary').then(setData).catch(() => {}); }, []); return <ProductShell title="Incident Analytics"><section className="analytics-grid"><div className="metric-grid">{data.counts.map((item) => <article className="metric" key={item._id}><span>{item._id}</span><strong>{item.count}</strong><small>Avg risk {Number(item.averageRisk || 0).toFixed(2)}</small></article>)}</div><article className="panel"><h2>Incident history</h2><div className="table-list">{data.incidents.map((incident) => <div className="table-row" key={incident._id}><strong>{incident.h3Index}</strong><span>{incident.status}</span><span>{incident.riskScore}</span><time>{new Date(incident.detectedAt).toLocaleString()}</time></div>)}</div></article><article className="panel"><h2>Audit trail</h2><div className="table-list">{data.auditLogs.map((log) => <div className="table-row" key={log._id}><strong>{log.action}</strong><span>{log.entityType}</span><time>{new Date(log.createdAt).toLocaleString()}</time></div>)}</div></article></section></ProductShell>; }

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthForm />} />
      <Route path="/operator" element={<RequireAuth roles={['operator']}><OperatorConsole /></RequireAuth>} />
      <Route path="/field" element={<RequireAuth roles={['field']}><FieldConsole /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminConsole /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth roles={['operator', 'admin']}><Analytics /></RequireAuth>} />
      <Route path="/dashboard" element={<Navigate to="/operator" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
