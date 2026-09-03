import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn, friendlyAuthError } from '../firebase/auth';
import { useToast } from '../contexts/ToastContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      showToast('Welcome back to Seedwel Hub!', 'success');
      navigate('/');
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Welcome back</h1>
      <p className="auth-card__subtitle">Log in to your Seedwel Hub account.</p>

      {error && <div className="form__msg form__msg--error">{error}</div>}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__group">
          <label className="form__label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="form__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <div className="auth-card__alt">
        <Link to="/forgot-password">Forgot password?</Link>
      </div>
      <div className="auth-card__alt">
        Don't have an account? <Link to="/register">Create one</Link>
      </div>
    </div>
  );
}
