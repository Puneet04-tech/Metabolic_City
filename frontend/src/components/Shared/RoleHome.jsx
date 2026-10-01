import { Navigate } from 'react-router-dom';
import { getStoredUser } from '../../api.js';

const homeFor = (role) => (role === 'field_crew' ? '/field' : role === 'administrator' ? '/admin' : '/operator');

function RoleHome() {
  const user = getStoredUser();
  const normalizedRole = (user.role || '').toLowerCase();
  const home = normalizedRole ? homeFor(normalizedRole) : '/';
  return <Navigate to={home} replace />;
}

export default RoleHome;
