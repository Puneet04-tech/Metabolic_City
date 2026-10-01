import { NavLink, useNavigate } from 'react-router-dom';
import { apiRequest, clearSession, getStoredUser } from '../../api.js';

const roleLabels = {
  operator: 'Dispatch Operator',
  field_crew: 'Field Crew',
  administrator: 'Administrator',
};

function ProductShell({ title, children }) {
  const user = getStoredUser();
  const navigate = useNavigate();
  const logout = async () => { try { await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* clear local session */ } clearSession(); navigate('/'); };

  // Normalize role to lowercase for consistent checking
  const normalizedRole = (user.role || '').toLowerCase();

  const nav = [];
  if (['operator', 'administrator'].includes(normalizedRole)) nav.push({ to: '/operator', label: 'Operator' });
  if (['field_crew', 'operator', 'administrator'].includes(normalizedRole)) nav.push({ to: '/field', label: 'Field Crew' });
  if (normalizedRole === 'administrator') nav.push({ to: '/admin', label: 'Admin' });
  if (['operator', 'administrator'].includes(normalizedRole)) nav.push({ to: '/analytics', label: 'Analytics' });

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
          <span className="role-badge">{roleLabels[user.role?.toUpperCase()] || user.role}</span>
          <button type="button" onClick={logout} className={'btn-secondary'}>Sign out</button>
        </div>
      </header>
      {children}
    </main>
  );
}

export default ProductShell;
