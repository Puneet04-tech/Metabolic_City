import { AlertTriangle } from 'lucide-react';
import { useRouteError } from 'react-router-dom';
import Button from '../ui/Button/Button';
import SystemPage from './SystemPage';

/**
 * The route-level error element.
 *
 * React Router hands a thrown render error to this component, so a single
 * failing route never takes the whole application down.
 */
export default function RouteError() {
  const error = useRouteError();

  const description =
    error?.statusText
      ? `${error.status} ${error.statusText}. The page could not be loaded.`
      : 'The page could not be loaded. The error was contained to this route.';

  return (
    <SystemPage
      icon={AlertTriangle}
      title="This page could not be displayed"
      description={description}
      action={
        <Button variant="primary" onClick={() => window.location.assign('/')}>
          Go home
        </Button>
      }
      secondaryAction={
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      }
    />
  );
}
