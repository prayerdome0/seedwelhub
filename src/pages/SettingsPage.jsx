import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { updateProfile } from '../services/userService';
import { sendPasswordReset, isEmailVerified, sendVerificationEmail, logout } from '../firebase/auth';
import { getFirebaseMessagingToken, requestNotificationPermission } from '../firebase/messaging';
import { saveDoc } from '../services/_base';
import { COLLECTIONS } from '../utils/constants';

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'profile', label: 'Profile' },
  { id: 'password', label: 'Password' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'sessions', label: 'Sessions' },
];

export default function SettingsPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState('account');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  if (loading || !profile) {
    return <div className="container page"><Spinner size="large" /></div>;
  }

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile(profile.uid, { name, phone, location, bio });
      await refreshProfile();
      showToast('Settings saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    try {
      await sendPasswordReset(user.email);
      showToast('Password reset email sent. Please check your inbox.', 'success');
    } catch (err) {
      showToast('Could not send reset email.', 'error');
    }
  };

  const handleVerifyEmail = async () => {
    try {
      await sendVerificationEmail();
      showToast('Verification email sent. Please check your inbox.', 'success');
    } catch (err) {
      showToast('Could not send verification email.', 'error');
    }
  };

  const handleEnablePush = async () => {
    const perm = await requestNotificationPermission();
    if (!perm.ok) {
      showToast('Notifications are not available in your browser.', 'error');
      return;
    }
    const tokenResult = await getFirebaseMessagingToken();
    if (tokenResult.ok) {
      // Guard against writing when push token flow is unavailable; VAPID key may
      // not be set in this environment.
      try {
        await saveDoc(COLLECTIONS.DEVICE_TOKENS, `${user.uid}_${Date.now()}`, {
          uid: user.uid,
          token: tokenResult.token,
        });
        setPushEnabled(true);
        showToast('Push notifications enabled.', 'success');
      } catch (err) {
        showToast('Could not save your notification token.', 'error');
      }
    } else {
      showToast('Push notifications could not be set up in this environment.', 'info');
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Settings</h1>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tabs__tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="panel">
          <h2 className="panel__title">Profile</h2>
          <div className="form">
            <div className="form__group">
              <label className="form__label">Name</label>
              <input className="form__input" defaultValue={profile.name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label">Phone</label>
                <input className="form__input" defaultValue={profile.phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256…" />
              </div>
              <div className="form__group">
                <label className="form__label">Location</label>
                <input className="form__input" defaultValue={profile.location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
              </div>
            </div>
            <div className="form__group">
              <label className="form__label">Bio</label>
              <textarea className="form__textarea" defaultValue={profile.bio} onChange={(e) => setBio(e.target.value)} placeholder="About you" />
            </div>
            <div>
              <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'account' && (
        <div className="panel">
          <h2 className="panel__title">Account</h2>
          <dl className="kv">
            <dt>Email</dt><dd>{user.email}</dd>
            <dt>Email status</dt>
            <dd>
              {isEmailVerified() ? 'Verified' : 'Not verified'}
              {!isEmailVerified() && (
                <button type="button" className="btn btn--outline btn--sm" onClick={handleVerifyEmail} style={{ marginLeft: 10 }}>
                  Send verification
                </button>
              )}
            </dd>
            <dt>Role</dt><dd>{profile.role}</dd>
            <dt>Joined</dt><dd>{profile.createdAt ? new Date(profile.createdAt?.toDate ? profile.createdAt.toDate() : profile.createdAt).toLocaleDateString() : '—'}</dd>
          </dl>
        </div>
      )}

      {tab === 'password' && (
        <div className="panel">
          <h2 className="panel__title">Password</h2>
          <p className="text-muted">We'll send a reset link to your email address.</p>
          <Button variant="primary" onClick={handleSendPasswordReset}>Send Password Reset Email</Button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="panel">
          <h2 className="panel__title">Notifications</h2>
          <p className="text-muted">Enable push notifications to get updates on messages, orders and more.</p>
          <Button variant="primary" onClick={handleEnablePush}>
            {pushEnabled ? 'Push Notifications Enabled ✓' : 'Enable Push Notifications'}
          </Button>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="panel">
          <h2 className="panel__title">Privacy</h2>
          <p className="text-muted">Your profile, orders and messages are private. You control who sees your content.</p>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="panel">
          <h2 className="panel__title">Sessions &amp; Devices</h2>
          <p className="text-muted">You are currently signed in on this device.</p>
          <Button variant="danger" onClick={handleLogout}>Log Out</Button>
        </div>
      )}

      {/* Default tab content if not matched above */}
      {!['account', 'profile', 'password', 'notifications', 'privacy', 'sessions'].includes(tab) && (
        <div className="panel">
          <h2 className="panel__title">Settings</h2>
          <p className="text-muted">Select a section above.</p>
        </div>
      )}
    </div>
  );
}
