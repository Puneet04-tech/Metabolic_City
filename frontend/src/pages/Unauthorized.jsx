import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button/Button';
import SystemPage from '../components/system/SystemPage';

/** 403 — the signed-in role cannot open this area. */
export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <SystemPage
      icon={Lock}
      title="Access denied"
      description="Your role does not have access to this area. Ask an administrator if you need it."
      action={
        <Button variant="primary" onClick={() => navigate('/')}>
          Go home
        </Button>
      }
      secondaryAction={
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Go back
        </Button>
      }
    />
  );
}
