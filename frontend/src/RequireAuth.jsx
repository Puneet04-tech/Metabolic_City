import { Navigate } from 'react-router-dom';
import { isAuthenticated } from './api.js';

export default function RequireAuth({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return children;
}
