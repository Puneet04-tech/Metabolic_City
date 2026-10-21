import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/shell/AppShell/AppShell';
import AdminNav from '../components/Admin/AdminNav';
import PerformancePanel from '../components/Admin/PerformancePanel';
import QrPanel from '../components/Admin/QrPanel';
import ThresholdForm from '../components/Admin/ThresholdForm';
import UsersPanel from '../components/Admin/UsersPanel';
import { apiRequest, clearSession, getStoredUser } from '../api.js';
import { getNavItems } from '../lib/routes.js';
import styles from './Admin.module.css';

const SECTIONS = [
  { id: 'thresholds', label: 'Risk thresholds' },
  { id: 'users', label: 'Users' },
  { id: 'qr', label: 'QR codes' },
  { id: 'system', label: 'System performance' },
];

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = getStoredUser();
  const navItems = getNavItems(user.role);
  const section = SECTIONS.some((item) => item.id === searchParams.get('section'))
    ? searchParams.get('section')
    : SECTIONS[0].id;

  const selectSection = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams);
      params.set('section', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSignOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* the local session is cleared either way */
    }
    clearSession();
    window.location.assign('/');
  }, []);

  return (
    <AppShell
      title="Administration"
      cityCode={user.cityCode}
      user={user}
      navItems={navItems}
      onSignOut={handleSignOut}
    >
      <div className={styles.page}>
        <AdminNav sections={SECTIONS} activeId={section} onSelect={selectSection} />

        <div className={styles.content}>
          {section === 'thresholds' ? <ThresholdForm /> : null}
          {section === 'users' ? <UsersPanel /> : null}
          {section === 'qr' ? <QrPanel cityCode={user.cityCode} /> : null}
          {section === 'system' ? <PerformancePanel /> : null}
        </div>
      </div>
    </AppShell>
  );
}
