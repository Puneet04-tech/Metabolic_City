import { useState, useEffect } from 'react';
import { apiRequest } from '../../api.js';
import ProductShell from '../Shared/ProductShell.jsx';

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

  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);

  const dryRun = async () => {
    try {
      const result = await apiRequest('/v1/admin/weights/dry-run', { method: 'POST', body: { ...weights, threshold } });
      setPreview(result.cells || []);
      setMessage('');
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
      await apiRequest(`/v1/admin/users/${user._id}`, { method: 'PATCH', body: { active: !user.active } });
      setUsers((previous) => previous.map((u) => (u._id === user._id ? { ...u, active: !u.active } : u)));
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
                  <span>{row.compositeRisk.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>User management</h2>
          <p className="panel-sub">Enable or disable operator, field crew, and administrator accounts.</p>
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

export default AdminConsole;
