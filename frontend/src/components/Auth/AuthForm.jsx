import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest, setSession, clearSession } from '../../api.js';

const initialForm = {
  cityCode: '',
  role: 'operator',
  email: '',
  name: '',
  municipalityCode: '',
  opStaffId: '',
  opPassword: '',
  crewPhone: '',
  crewPasscode: '',
  adminId: '',
  adminToken: '',
};

const homeFor = (role) => (role === 'field_crew' ? '/field' : role === 'administrator' ? '/admin' : '/operator');

function AuthForm({ mode: initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [currentRole, setCurrentRole] = useState('OPERATOR');
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const errorParam = searchParams.get('error');
  if (errorParam && !alert) {
    setAlert({ type: 'error', message: decodeURIComponent(errorParam) });
  }

  const showAlert = (message, type = 'error') => setAlert({ type, message });
  const clearAlert = () => setAlert(null);

  const buildPayload = () => {
    const role = currentRole.toUpperCase();
    const base = { cityCode: form.cityCode.trim(), role, password: form.opPassword || form.crewPasscode || form.adminToken };
    if (mode === 'signup') {
      base.name = form.name.trim();
      base.email = form.email.trim();
      base.jurisdiction = form.municipalityCode.trim();
    }
    if (role === 'OPERATOR') base.staffId = form.opStaffId.trim();
    if (role === 'FIELD_CREW') base.phone = form.crewPhone.trim();
    if (role === 'ADMINISTRATOR') base.adminId = form.adminId.trim();
    return base;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearAlert();
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
      const normalizedRole = (data.user.role || '').toLowerCase();
      setTimeout(() => navigate(homeFor(normalizedRole)), 400);
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

  const handleInputChange = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <p>{mode === 'login' ? 'Access your municipal command console' : 'Register for Metabolic City platform'}</p>
        </div>

        <div className="auth-mode-switch">
          <button type="button" className={mode === 'login' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('login')}>Login</button>
          <button type="button" className={mode === 'signup' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('signup')}>Sign Up</button>
        </div>

        {alert && alert.message && <div className={`alert-banner ${alert.type || 'error'}`}>{alert.message}</div>}

        <div className="notice-box">
          <strong>Public Notice:</strong> Citizens do not log in here. Incident reports are ingested automatically via municipal hotlines and soft-sensing feeds.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="role-selector">
            <label>Role</label>
            <div className="role-tabs">
              {['OPERATOR', 'FIELD_CREW', 'ADMINISTRATOR'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={currentRole === role ? 'role-tab active' : 'role-tab'}
                  onClick={() => setCurrentRole(role)}
                >
                  {role.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>City Code</label>
            <input type="text" value={form.cityCode} onChange={handleInputChange('cityCode')} placeholder="e.g., CITY-IND-BPL8" required />
          </div>

          {mode === 'signup' && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={form.name} onChange={handleInputChange('name')} placeholder="Your full name" required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={form.email} onChange={handleInputChange('email')} placeholder="your@email.com" required />
              </div>
              <div className="form-group">
                <label>Municipality Code</label>
                <input type="text" value={form.municipalityCode} onChange={handleInputChange('municipalityCode')} placeholder="Optional jurisdiction code" />
              </div>
            </>
          )}

          {currentRole === 'OPERATOR' && (
            <div className="form-group">
              <label>Staff ID</label>
              <input type="text" value={form.opStaffId} onChange={handleInputChange('opStaffId')} placeholder="Operator Staff ID" required />
            </div>
          )}

          {currentRole === 'FIELD_CREW' && (
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" value={form.crewPhone} onChange={handleInputChange('crewPhone')} placeholder="Mobile number" required />
            </div>
          )}

          {currentRole === 'ADMINISTRATOR' && (
            <div className="form-group">
              <label>Administrator ID</label>
              <input type="text" value={form.adminId} onChange={handleInputChange('adminId')} placeholder="Admin ID" required />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={form.opPassword || form.crewPasscode || form.adminToken}
              onChange={handleInputChange(currentRole === 'OPERATOR' ? 'opPassword' : currentRole === 'FIELD_CREW' ? 'crewPasscode' : 'adminToken')}
              placeholder="Your password"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" className="link-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthForm;
