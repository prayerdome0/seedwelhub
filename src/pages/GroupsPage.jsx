import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Image from '../components/Image';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import Badge from '../components/Badge';
import useAsync from '../hooks/useAsync';
import { getPublicGroups, getGroupsForUser, createGroup } from '../services/groupService';

export default function GroupsPage() {
  const { user } = useAuth();
  const publicGroups = useAsync(() => getPublicGroups(), []);
  const myGroups = useAsync(
    () => (user ? getGroupsForUser(user.uid) : Promise.resolve([])),
    [user]
  );

  const renderGroup = (g) => (
    <Link key={g.id} to={`/group/${g.id}`} className="card business-card">
      <div className="business-card__media">
        {g.image ? (
          <Image src={g.image} alt={g.name} className="business-card__logo" />
        ) : (
          <div className="business-card__logo business-card__logo--empty">{g.name?.[0] || 'G'}</div>
        )}
      </div>
      <div className="business-card__body">
        <h3 className="business-card__title">{g.name}</h3>
        {g.category && <Badge tone="info">{g.category}</Badge>}
        {g.description && <p className="business-card__desc">{g.description}</p>}
        <div className="business-card__meta">
          <span className="text-muted">{g.memberCount || 0} members · {g.visibility}</span>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Groups</h1>
        <p className="page__subtitle">Join groups and communities on Xacheus.</p>
      </div>

      <section className="section">
        <h2 className="section__title">Explore public groups</h2>
        {publicGroups.loading && <Spinner size="sm" />}
        {publicGroups.error && <ErrorState message={publicGroups.error} onRetry={publicGroups.retry} />}
        {!publicGroups.loading && !publicGroups.error && publicGroups.data?.length === 0 && (
          <EmptyState title="No public groups yet" message="Groups will appear here as they are created." />
        )}
        {!publicGroups.loading && !publicGroups.error && publicGroups.data?.length > 0 && (
          <div className="grid grid--businesses">
            {publicGroups.data.map(renderGroup)}
          </div>
        )}
      </section>

      {user && (
        <section className="section">
          <h2 className="section__title">My groups</h2>
          {myGroups.loading && <Spinner size="sm" />}
          {!myGroups.loading && myGroups.data?.length === 0 && <EmptyState title="You haven't joined any groups" />}
          {!myGroups.loading && myGroups.data?.length > 0 && (
            <div className="grid grid--businesses">
              {myGroups.data.map((m) => renderGroup(m.group || m))}
            </div>
          )}
        </section>
      )}

      <section className="section">
        <CreateGroupForm onCreated={publicGroups.retry} onCreateJoined={user ? myGroups.retry : undefined} />
      </section>
    </div>
  );
}

function CreateGroupForm({ onCreated, onCreateJoined }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      showToast('Please log in to create a group.', 'info');
      return;
    }
    setSaving(true);
    try {
      const group = await createGroup({ creatorId: user.uid, name, description, category, visibility });
      onCreated();
      if (onCreateJoined) onCreateJoined();
      setName('');
      setDescription('');
      setCategory('');
      setOpen(false);
      showToast('Group created!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not create group.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>Create a Group</button>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel__title">Create a Group</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form__group">
          <label className="form__label">Group name</label>
          <input className="form__input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Group name" />
        </div>
        <div className="form__group">
          <label className="form__label">Description</label>
          <textarea className="form__textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this group about?" />
        </div>
        <div className="form__row">
          <div className="form__group">
            <label className="form__label">Category</label>
            <input className="form__input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Farming, Trading" />
          </div>
          <div className="form__group">
            <label className="form__label">Visibility</label>
            <select className="form__select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>
        <div className="flex gap-16">
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating…' : 'Create Group'}</button>
          <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
