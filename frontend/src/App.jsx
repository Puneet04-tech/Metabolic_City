import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAlert({ message: '', type: '' });

    const cityCode = form.municipalityCode.trim();
    if (!cityCode) {
      showAlert('ERR_VALIDATION: Municipality / City Code is required.');
      return;
    }

    if (mode === 'signup') {
      if (!form.name.trim() || !form.email.trim()) {
        showAlert('ERR_VALIDATION: Full name and email are required for signup.');
        return;
      }
    }

    if (currentRole === 'OPERATOR') {
      const staffId = form.opStaffId.trim();
      const pass = form.opPassword;
      if (!staffId || !pass) {
        showAlert(mode === 'signup'
          ? 'ERR_SIGNUP: Operator ID and Password are required.'
          : 'ERR_AUTH_MISSING_CREDENTIALS: Staff ID and Password are required for Dispatchers.');
        return;
      }

      setLoading(true);
      try {
        const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
        const payload = mode === 'signup'
          ? {
              name: form.name,
              email: form.email,
              cityCode,
              role: 'operator',
              staffId,
              password: pass,
            }
          : {
              cityCode,
              role: 'operator',
              staffId,
              password: pass,
            };

        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Authentication failed');

        localStorage.setItem('metabolic-city-token', data.token);
        localStorage.setItem('metabolic-city-user', JSON.stringify(data.user));
        showAlert(mode === 'signup' ? 'Operator account created successfully.' : 'Authenticating Dispatcher... Launching Command Dashboard.', 'success');
        setTimeout(() => navigate('/dashboard'), 600);
      } catch (error) {
        showAlert(error.message || 'Authentication failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (currentRole === 'FIELD_CREW') {
      const phone = form.crewPhone.trim();
      const pin = form.crewPasscode.trim();
      if (!phone || !pin) {
        showAlert(mode === 'signup'
          ? 'ERR_SIGNUP: Mobile number and password are required for field crew.'
          : 'ERR_AUTH_SMS: Phone Number and OTP PIN are required for Field Crew.');
        return;
      }

      setLoading(true);
      try {
        const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
        const payload = mode === 'signup'
          ? {
              name: form.name,
              email: form.email,
              cityCode,
              role: 'field_crew',
              phone,
              password: pin,
            }
          : {
              cityCode,
              role: 'field_crew',
              phone,
              password: pin,
            };

        const response = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Authentication failed');

        localStorage.setItem('metabolic-city-token', data.token);
        localStorage.setItem('metabolic-city-user', JSON.stringify(data.user));
        showAlert(mode === 'signup' ? 'Field crew account created successfully.' : 'Verifying Mobile Session...', 'success');
        setTimeout(() => navigate('/dashboard'), 600);
      } catch (error) {
        showAlert(error.message || 'Authentication failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const adminId = form.adminId.trim();
    const token = form.adminToken;
    if (!adminId || !token) {
      showAlert(mode === 'signup'
        ? 'ERR_SIGNUP: Administrator ID and Password are required.'
        : 'ERR_AUTH_ADMIN: Administrator ID and Token are required.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const payload = mode === 'signup'
        ? {
            name: form.name,
            email: form.email,
            cityCode,
            role: 'administrator',
            adminId,
            password: token,
          }
        : {
            cityCode,
            role: 'administrator',
            adminId,
            password: token,
          };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Authentication failed');

      localStorage.setItem('metabolic-city-token', data.token);
      localStorage.setItem('metabolic-city-user', JSON.stringify(data.user));
      showAlert(mode === 'signup' ? 'Administrator account created successfully.' : 'Elevating Security Clearance...', 'success');
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (error) {
      showAlert(error.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="login-card">
        <div className="card-header">
          <div className="doc-badge">METABOLICCITY AI — V1 GATEWAY</div>
          <h1>Municipal Access Portal</h1>
          <p>Software-First Urban Intelligence Command System</p>
        </div>

        <div className="role-tabs">
          {Object.entries(roleLabels).map(([role, label]) => (
            <button
              key={role}
              type="button"
              className={currentRole === role ? 'tab-btn active' : 'tab-btn'}
              onClick={() => handleRoleSwitch(role)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="card-body">
          <div className="auth-mode-switch">
            <button
              type="button"
              className={mode === 'login' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setMode('signup')}
            >
              Sign Up
            </button>
          </div>

          {alert.message && <div className={`alert-banner ${alert.type}`}>{alert.message}</div>}

          <div className="notice-box">
            <strong>Public Notice:</strong> Citizens do not log in here. Incident reports are ingested automatically via municipal hotlines and soft-sensing feeds.
          </div>

          <form id="loginForm" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleFieldChange}
                    placeholder="Enter full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleFieldChange}
                    placeholder="name@municipality.gov"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="municipalityCode">Municipality / City Code</label>
              <input
                id="municipalityCode"
                name="municipalityCode"
                type="text"
                value={form.municipalityCode}
                onChange={handleFieldChange}
                placeholder="e.g. CITY-IND-BPL8"
                required
              />
            </div>

            {currentRole === 'OPERATOR' && (
              <div className="field-group-dynamic active">
                <div className="form-group">
                  <label htmlFor="opStaffId">Operator Console ID</label>
                  <input
                    id="opStaffId"
                    name="opStaffId"
                    type="text"
                    value={form.opStaffId}
                    onChange={handleFieldChange}
                    placeholder="e.g. OP-8842"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="opPassword">Security Clearance Password</label>
                  <input
                    id="opPassword"
                    name="opPassword"
                    type="password"
                    value={form.opPassword}
                    onChange={handleFieldChange}
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            )}

            {currentRole === 'FIELD_CREW' && (
              <div className="field-group-dynamic active">
                <div className="form-group">
                  <label htmlFor="crewPhone">Registered Mobile Number</label>
                  <input
                    id="crewPhone"
                    name="crewPhone"
                    type="tel"
                    value={form.crewPhone}
                    onChange={handleFieldChange}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="crewPasscode">SMS Gateway OTP / Passcode</label>
                  <input
                    id="crewPasscode"
                    name="crewPasscode"
                    type="password"
                    value={form.crewPasscode}
                    onChange={handleFieldChange}
                    placeholder="6-digit PIN"
                  />
                </div>
              </div>
            )}

            {currentRole === 'ADMINISTRATOR' && (
              <div className="field-group-dynamic active">
                <div className="form-group">
                  <label htmlFor="adminId">Administrator Account</label>
                  <input
                    id="adminId"
                    name="adminId"
                    type="text"
                    value={form.adminId}
                    onChange={handleFieldChange}
                    placeholder="e.g. ADM-SYS-01"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="adminToken">Hardware Token / Password</label>
                  <input
                    id="adminToken"
                    name="adminToken"
                    type="password"
                    value={form.adminToken}
                    onChange={handleFieldChange}
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            )}

            <button type="submit" id="submitBtn" className="btn-submit" disabled={loading}>
              {loading
                ? mode === 'signup' ? 'Creating account...' : 'Authenticating...'
                : mode === 'signup'
                  ? `Create ${roleLabels[currentRole].replace(' ', ' ')} Account`
                  : currentRole === 'OPERATOR'
                    ? 'Authenticate Operator Console'
                    : currentRole === 'FIELD_CREW'
                      ? 'Access Dispatch Queue (SMS)'
                      : 'Access System Configuration'}
            </button>
          </form>
        </div>

        <div className="card-footer">
          Deterministic Safety Logic & Audit Log Enabled<br />
          System Engine v1.0.4 — MongoDB Atlas Session Cluster
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('metabolic-city-user') || '{}');

  return (
    <div className="dashboard-shell">
      <div className="dashboard-card">
        <h2>Metabolic City Dashboard</h2>
        <p>Welcome, {user.name || 'Operator'}.</p>
        <p>Role: {user.role || 'operator'}</p>
        <p>City: {user.cityCode || 'N/A'}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthForm />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
