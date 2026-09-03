import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordReset, friendlyAuthError } from '../firebase/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSent(false);
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Reset your password</h1>
      <p className="auth-card__subtitle">
        Enter the email linked to your account and we'll send you a reset link.
      </p>

      {sent && (
        <div className="form__msg form__msg--success">
          Password reset email sent. Please check your inbox.
        </div>
      )}
      {error && <div className="form__msg form__msg--error">{error}</div>}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__group">
          <label className="form__label" htmlFor="fp-email">Email</label>
          <input
            id="fp-email"
            type="email"
            className="form__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? 'Sending…' : 'Send Reset Email'}
        </button>
      </form>

      <div className="auth-card__alt">
        Remembered your password? <Link to="/login">Log in</Link>
      </div>
    </div>
  );
}
