import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage/HomePage.jsx';
import AuthForm from './components/Auth/AuthForm.jsx';
import OperatorConsole from './components/Operator/OperatorConsole.jsx';
import FieldConsole from './components/Field/FieldConsole.jsx';
import AdminConsole from './components/Admin/AdminConsole.jsx';
import Analytics from './components/Analytics/Analytics.jsx';
import RoleHome from './components/Shared/RoleHome.jsx';
import RequireAuth from './RequireAuth.jsx';

export default function App() {
  // Add ambient glow effect
  useEffect(() => {
    const ambientGlow = document.createElement('div');
    ambientGlow.className = 'ambient-glow';
    document.body.appendChild(ambientGlow);
    return () => ambientGlow.remove();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AuthForm mode="login" />} />
      <Route path="/signup" element={<AuthForm mode="signup" />} />
      <Route path="/role-home" element={<RequireAuth><RoleHome /></RequireAuth>} />
      <Route path="/operator" element={<RequireAuth roles={['operator']}><OperatorConsole /></RequireAuth>} />
      <Route path="/field" element={<RequireAuth roles={['field']}><FieldConsole /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminConsole /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth roles={['operator', 'admin']}><Analytics /></RequireAuth>} />
    </Routes>
  );
}
