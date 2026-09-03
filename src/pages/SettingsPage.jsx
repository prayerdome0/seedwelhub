import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { updateProfile } from '../services/userService';
import { sendPasswordReset, isEmailVerified, sendVerificationEmail, logout } from '../firebase/auth';
import { getFirebaseMessagingToken, requestNotificationPermission } from '../firebase/messaging';
import {
  getDeviceTokensForUser,
  saveDeviceToken,
  deleteDeviceTokensForUser,
} from '../services/deviceTokenService';

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
  const [pushBusy, setPushBusy] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);

  // Load the current push-notification state so the Setting screen reflects
  // what was previously enabled (stored token + granted browser permission).
  useEffect(() => {
    let active = true;
    if (!user || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      setPushEnabled(false);
      setPushLoading(false);
      return () => {
        active = false;
      };
    }
    getDeviceTokensForUser(user.uid, 1)
      .then((tokens) => {
        if (active) setPushEnabled((tokens || []).some((token) => token.active !== false));
      })
      .catch(() => {
        if (active) setPushEnabled(false);
      })
      .finally(() => {
        if (active) setPushLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

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
    setPushBusy(true);
    try {
      const perm = await requestNotificationPermission();
      if (!perm.ok) {
        showToast(
          perm.reason === 'unsupported'
            ? 'This browser does not support web push notifications.'
            : 'Push notifications are blocked. Allow notifications from your browser settings.',
          'error'
        );
        return;
      }

      const tokenResult = await getFirebaseMessagingToken();
      if (!tokenResult.ok) {
        if (tokenResult.reason === 'no-vapid-key') {
          showToast(
            'Push notifications need the public FCM VAPID key. Set VITE_FIREBASE_VAPID_PUBLIC_KEY in your environment.',
            'info'
          );
        } else {
          showToast('Push notifications could not be set up in this environment.', 'info');
        }
        return;
      }

      // Guard against writing when push token flow is unavailable; VAPID key may
      // not be set in this environment.
      try {
        await saveDeviceToken(user.uid, tokenResult.token);
        setPushEnabled(true);
        showToast('Push notifications enabled.', 'success');
      } catch (err) {
        showToast('Could not save your notification token.', 'error');
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await deleteDeviceTokensForUser(user.uid);
      setPushEnabled(false);
      showToast('Push notifications disabled on this device.', 'success');
    } catch (err) {
      showToast('Could not disable push notifications.', 'error');
    } finally {
      setPushBusy(false);
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
          <div className="mt-16">
            <Button
              variant="primary"
              loading={pushLoading || pushBusy}
              onClick={pushEnabled ? handleDisablePush : handleEnablePush}
            >
              {pushLoading
                ? 'Checking notification status…'
                : pushEnabled
                  ? 'Disable Push Notifications'
                  : 'Enable Push Notifications'}
            </Button>
          </div>
          {pushEnabled && (
            <p className="form__msg form__msg--success mt-16">
              ✓ Push notifications are enabled for this device.
            </p>
          )}
          {!pushEnabled && !pushLoading && (
            <p className="form__msg form__msg--info mt-16">
              In-app notifications are always on. Push adds alerts when the page is not in focus.
            </p>
          )}
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
