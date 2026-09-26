import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest, setSession, clearSession, getStoredUser } from './api.js';
import RequireAuth from './RequireAuth.jsx';

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
        <h3>Live H3 Risk Cells</h3>
        {cells.length === 0 ? <p>No telemetry has been received for this jurisdiction.</p> : (
          <div className="cell-list">
            {cells.map((cell) => (
              <article className={`risk-cell risk-${cell.compositeRisk >= 7 ? 'critical' : cell.compositeRisk >= 4 ? 'warning' : 'normal'}`} key={cell.h3Index}>
                <strong>{cell.h3Index}</strong>
                <span>Risk {cell.compositeRisk.toFixed(2)}</span>
                <small>M {cell.scores.mobility.toFixed(1)} / C {cell.scores.climate.toFixed(1)} / V {cell.scores.vulnerability.toFixed(1)}</small>
                {cell.isDegraded && <small>DEGRADED_DATA</small>}
              </article>
            ))}
          </div>
        )}
        <button type="button" className="btn-submit" onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthForm />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="/operator/*" element={<RequireAuth roles={['operator']}><Dashboard /></RequireAuth>} />
      <Route path="/field/*" element={<RequireAuth roles={['field']}><Dashboard /></RequireAuth>} />
      <Route path="/admin/*" element={<RequireAuth roles={['admin']}><Dashboard /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
