import { SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button/Button';
import SystemPage from '../components/system/SystemPage';

/** 404. */
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <SystemPage
      icon={SearchX}
      title="Page not found"
      description="The page you asked for does not exist. It may have been moved, or the link may be out of date."
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
