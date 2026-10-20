import { Link } from 'react-router-dom';
import AuthShell from '../components/shell/AuthShell/AuthShell';
import AuthForm from '../components/auth/AuthForm';

/** Sign in. */
export default function SignIn() {
  return (
    <AuthShell
      title="Sign in"
      description="Access the console with the city code and the credentials issued by your municipality."
      footer={
        <p>
          No account yet? <Link to="/signup">Create an account</Link>
        </p>
      }
    >
      <AuthForm mode="signin" />
    </AuthShell>
  );
}
