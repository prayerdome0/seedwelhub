import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendVerificationEmail, isEmailVerified, getCurrentUser, friendlyAuthError, logout } from '../firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { updateUser } from '../services/userService';

export default function VerifyEmailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);

  const refreshStatus = async () => {
    const current = getCurrentUser();
    if (!current) {
      setVerified(false);
      return false;
    }
    await current.reload().catch(() => {});
    const isVerified = isEmailVerified();
    setVerified(isVerified);
    if (isVerified && user) {
      await updateUser(user.uid, { emailVerified: true }).catch(() => {});
    }
    return isVerified;
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    setStatus('sending');
    setMessage('');
    try {
      await sendVerificationEmail();
      setStatus('sent');
      setMessage('Verification email sent. Please check your inbox.');
    } catch (err) {
      setStatus('error');
      setMessage(friendlyAuthError(err));
    }
  };

  const handleRefresh = async () => {
    const ok = await refreshStatus();
    if (ok) {
      setMessage('Your email is verified!');
      showToast('Email verified successfully!', 'success');
      setTimeout(() => navigate('/'), 1200);
    } else {
      setMessage('Your email is not verified yet. Check your inbox and click the link.');
    }
  };

  const handleContinueSignedOut = async () => {
    await logout().catch(() => {});
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="auth-card">
        <h1 className="auth-card__title">Verify your email</h1>
        <p className="auth-card__subtitle">Please sign in to verify your email address.</p>
        <Link to="/login" className="btn btn--primary btn--block">Go to Log In</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1 className="auth-card__title">Verify your email</h1>
      <p className="auth-card__subtitle">
        We sent a verification link to <strong>{user.email}</strong>. Click the
        link in your inbox to activate your Seedwel Hub account.
      </p>

      {verified ? (
        <div className="form__msg form__msg--success">Your email is verified. You're all set!</div>
      ) : (
        <>
          {status === 'sent' && <div className="form__msg form__msg--success">{message}</div>}
          {status === 'error' && <div className="form__msg form__msg--error">{message}</div>}
          {typeof message === 'string' && message && status !== 'sent' && status !== 'error' && (
            <div className="form__msg form__msg--info">{message}</div>
          )}
        </>
      )}

      <div className="stack mt-24">
        {verified ? (
          <Link to="/" className="btn btn--primary btn--block">Continue to Seedwel Hub</Link>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={handleSend}
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send Verification Email'}
            </button>
            <button type="button" className="btn btn--secondary btn--block" onClick={handleRefresh}>
              Check / Refresh Status
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={handleContinueSignedOut}>
              Sign In with Different Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
