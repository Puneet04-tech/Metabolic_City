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
import CitizenReport from './components/Citizen/CitizenReport.jsx';

// Apply the OLED spatial interface theme to the document
const applyTheme = () => {
  document.body.classList.add('neon-theme');
  document.documentElement.style.colorScheme = 'dark';
};

export default function App() {
  useEffect(() => {
    applyTheme();

    // OLED spatial canvas: neon radial glow, film grain, drifting light orbs
    const canvas = document.createElement('div');
    canvas.className = 'neon-bg';
    document.body.insertBefore(canvas, document.body.firstChild);

    const grain = document.createElement('div');
    grain.className = 'neon-grain';
    document.body.insertBefore(grain, canvas.nextSibling);

    const tints = [
      'rgba(139, 92, 246, 0.5)',
      'rgba(37, 99, 235, 0.45)',
      'rgba(34, 211, 238, 0.3)',
      'rgba(109, 40, 217, 0.42)',
    ];
    for (let i = 0; i < 5; i++) {
      const orb = document.createElement('div');
      orb.className = 'neon-orb';
      const size = 320 + Math.random() * 420;
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.left = `${Math.random() * 100}vw`;
      orb.style.top = `${Math.random() * 100}vh`;
      orb.style.background = tints[i % tints.length];
      orb.style.animationDelay = `${-i * 5.5}s`;
      orb.style.animationDuration = `${24 + i * 4}s`;
      canvas.appendChild(orb);
    }

    return () => {
      if (grain.parentNode) grain.parentNode.removeChild(grain);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);
  
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AuthForm mode="login" />} />
      <Route path="/signup" element={<AuthForm mode="signup" />} />
      <Route path="/citizen-report" element={<CitizenReport />} />
      <Route path="/role-home" element={<RequireAuth><RoleHome /></RequireAuth>} />
      <Route path="/operator" element={<RequireAuth roles={['operator']}><OperatorConsole /></RequireAuth>} />
      <Route path="/field" element={<RequireAuth roles={['field']}><FieldConsole /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminConsole /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth roles={['operator', 'admin']}><Analytics /></RequireAuth>} />
    </Routes>
  );
}
