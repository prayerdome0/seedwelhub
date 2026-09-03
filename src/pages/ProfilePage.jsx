import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import useAsync from '../hooks/useAsync';
import { updateProfile } from '../services/userService';
import { getOrdersByBuyer } from '../services/orderService';
import { getNotificationsForUser } from '../services/notificationService';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import { logout } from '../firebase/auth';
import { formatDate, relativeTime } from '../utils/format';

export default function ProfilePage() {
  const { user, profile, isAdmin, loading, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');

  const orders = useAsync(
    () => (user ? getOrdersByBuyer(user.uid) : Promise.resolve([])),
    [user]
  );
  const notifications = useAsync(
    () => (user ? getNotificationsForUser(user.uid) : Promise.resolve([])),
    [user]
  );

  if (loading || !profile) {
    return (
      <div className="container page"><Spinner size="large" /></div>
    );
  }

  const startEdit = () => {
    setEditing(true);
    setName(profile.name || '');
    setBio(profile.bio || '');
    setLocation(profile.location || '');
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const result = await uploadImageToCloudinary(file);
      await updateProfile(profile.uid, { photoURL: result.secureUrl });
      await refreshProfile();
      showToast('Profile photo updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Photo upload failed.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(profile.uid, { name, bio, location });
      await refreshProfile();
      setEditing(false);
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
    navigate('/');
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">My Profile</h1>
      </div>

      {/* Profile hero */}
      <div className="profile-hero">
        <div className="profile-hero__inner">
          <div className="relative">
            <Avatar src={profile.photoURL} name={profile.name || user.email} size="xl" />
            <label className="btn btn--outline btn--sm mt-8" style={{ marginTop: 8 }}>
              {uploadingPhoto ? 'Uploading…' : 'Change'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} disabled={uploadingPhoto} />
            </label>
          </div>
          <div>
            <h1 className="profile-hero__name">{profile.name || 'Unnamed User'}</h1>
            <div className="profile-hero__meta">@{profile.username || 'username'}</div>
            <div className="flex items-center gap-8 mt-8">
              <Badge tone="info">{isAdmin ? 'Admin' : 'User'}</Badge>
              {profile.accountStatus && <Badge tone="neutral">{profile.accountStatus}</Badge>}
            </div>
          </div>
          <div className="profile-hero__actions">
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>Edit Profile</Button>
            <Link to="/settings" className="btn btn--secondary">Settings</Link>
            {isAdmin && <Link to="/admin" className="btn btn--navy">Admin</Link>}
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="panel mt-16">
          <h2 className="panel__title">Edit Profile</h2>
          <div className="form">
            <div className="form__group">
              <label className="form__label">Name</label>
              <input className="form__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="form__group">
              <label className="form__label">Bio</label>
              <textarea className="form__textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself" />
            </div>
            <div className="form__group">
              <label className="form__label">Location</label>
              <input className="form__input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
            </div>
            <div className="flex gap-16">
              <Button variant="primary" onClick={handleSave} loading={saving}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div className="detail-layout mt-16">
        <div className="detail-main">
          {/* Account info */}
          <div className="panel">
            <h2 className="panel__title">Account Information</h2>
            <dl className="kv">
              <dt>Email</dt><dd>{user.email}</dd>
              <dt>Email verified</dt>
              <dd>{user.emailVerified ? 'Yes' : 'Not yet'}</dd>
              <dt>Phone</dt><dd>{profile.phone || '—'}</dd>
              <dt>Role</dt><dd>{profile.role || 'user'}</dd>
              <dt>Joined</dt><dd>{formatDate(profile.createdAt)}</dd>
              <dt>Status</dt><dd>{profile.accountStatus || 'active'}</dd>
            </dl>
          </div>

          {/* Recent orders */}
          <div className="panel">
            <h2 className="panel__title">Recent Orders</h2>
            {orders.loading && <Spinner size="sm" />}
            {orders.error && <p className="text-muted">Could not load orders.</p>}
            {!orders.loading && !orders.error && orders.data?.length === 0 && (
              <p className="text-muted">You haven't placed any orders yet.</p>
            )}
            {orders.data?.length > 0 && (
              <ul>
                {orders.data.slice(0, 5).map((o) => (
                  <li key={o.id} className="notif-item">
                    <div className="notif-item__body">
                      <Link to={`/order/${o.id}`} className="notif-item__title">{o.orderNumber}</Link>
                      <div className="notif-item__msg">{o.status} · {relativeTime(o.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent notifications */}
          <div className="panel">
            <h2 className="panel__title">Recent Activity</h2>
            {notifications.loading && <Spinner size="sm" />}
            {!notifications.loading && notifications.data?.length === 0 && (
              <p className="text-muted">No recent activity.</p>
            )}
            {notifications.data?.length > 0 && (
              <ul>
                {notifications.data.slice(0, 5).map((n) => (
                  <li key={n.id} className="notif-item">
                    <div className="notif-item__body">
                      <div className="notif-item__title">{n.title}</div>
                      <div className="notif-item__msg">{n.message}</div>
                      <div className="notif-item__time">{relativeTime(n.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="detail-aside">
          <div className="panel">
            <h3 className="panel__title">Quick Links</h3>
            <div className="stack">
              <Link to="/messages" className="btn btn--secondary">Messages</Link>
              <Link to="/groups" className="btn btn--secondary">Groups</Link>
              <Link to="/orders" className="btn btn--secondary">My Orders</Link>
              <Link to="/notifications" className="btn btn--secondary">Notifications</Link>
              {isAdmin && <Link to="/admin" className="btn btn--navy">Admin Dashboard</Link>}
            </div>
          </div>
          <div className="panel">
            <button type="button" className="btn btn--ghost btn--block" onClick={handleLogout}>Log Out</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
