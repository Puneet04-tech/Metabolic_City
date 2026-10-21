import { Link } from 'react-router-dom';
import AuthShell from '../components/shell/AuthShell/AuthShell';
import AuthForm from '../components/Auth/AuthForm';

/** Create an account. */
export default function SignUp() {
  return (
    <AuthShell
      title="Create an account"
      description="Register with your city code and the role you will use in the field."
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
