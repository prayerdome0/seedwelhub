import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Image from '../components/Image';
import Spinner from '../components/Spinner';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { ErrorState, NotFoundState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import { getGroup, getGroupMessages, sendGroupMessage, getGroupMembers, joinGroup, leaveGroup } from '../services/groupService';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import { relativeTime } from '../utils/format';

export default function GroupDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: group, loading, error, notFound, retry } = useDocument(getGroup, id, []);
  const messages = useAsync(
    () => (group ? getGroupMessages(group.id) : Promise.resolve([])),
    [group]
  );
  const members = useAsync(
    () => (group ? getGroupMembers(group.id) : Promise.resolve([])),
    [group]
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data?.length]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Group not found" message="This group does not exist or has been removed." />
      </div>
    );
  }

  const isMember = (members.data || []).some((m) => m.uid === user.uid);

  const handleJoin = async () => {
    try {
      await joinGroup(group.id, user.uid);
      members.retry();
      showToast('Joined group!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not join group.', 'error');
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup(group.id, user.uid);
      members.retry();
      showToast('Left group.', 'info');
    } catch (err) {
      showToast(err.message || 'Could not leave group.', 'error');
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendGroupMessage({ groupId: group.id, senderId: user.uid, text: trimmed, type: 'text' });
      setText('');
      messages.retry();
    } catch (err) {
      showToast(err.message || 'Could not send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImageToCloudinary(file);
      await sendGroupMessage({ groupId: group.id, senderId: user.uid, text: '', type: 'image', mediaUrl: result.secureUrl });
      messages.retry();
    } catch (err) {
      showToast(err.message || 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/groups" className="section__link">← Back to Groups</Link>
      </div>

      <div className="panel mb-16">
        <div className="flex items-center gap-16 flex-wrap">
          {group.image ? (
            <Image src={group.image} alt={group.name} className="avatar avatar--lg" />
          ) : (
            <div className="avatar avatar--lg avatar--text">{group.name?.[0] || 'G'}</div>
          )}
          <div>
            <h1 className="detail-heading__title">{group.name}</h1>
            <div className="flex items-center gap-8 flex-wrap">
              {group.category && <Badge tone="info">{group.category}</Badge>}
              <Badge tone="neutral">{group.visibility}</Badge>
              <span className="text-muted">{group.memberCount || 0} members</span>
            </div>
            {group.description && <p className="text-muted mt-8">{group.description}</p>}
          </div>
          <div className="profile-hero__actions">
            {isMember ? (
              <Button variant="danger" onClick={handleLeave}>Leave</Button>
            ) : (
              <Button variant="primary" onClick={handleJoin}>Join Group</Button>
            )}
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="chat-window" style={{ height: 'auto', minHeight: 440 }}>
          <div className="chat-window__header">
            <span className="chat-window__header-title">Group Chat</span>
          </div>
          <div className="chat-window__body">
            {messages.loading && <Spinner size="sm" />}
            {!messages.loading && messages.data?.length === 0 && (
              <p className="text-muted text-center">No messages yet. Be the first to say hello!</p>
            )}
            {!messages.loading && messages.data?.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.senderId === user.uid ? 'chat-bubble--own' : ''}`}>
                {m.type === 'image' && m.mediaUrl && <div className="chat-bubble__media"><Image src={m.mediaUrl} alt="Shared image" /></div>}
                {m.text && <div>{m.text}</div>}
                <div className="chat-bubble__meta">{relativeTime(m.createdAt)}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="chat-window__composer">
            <label className="btn btn--secondary btn--sm" style={{ flexShrink: 0 }}>
              {uploading ? '…' : '📎'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
            </label>
            <input
              className="chat-window__input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message…"
            />
            <button type="button" className="chat-window__send" onClick={handleSend} disabled={sending || !text.trim()} aria-label="Send">▶</button>
          </div>
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h3 className="panel__title">Members ({members.data?.length || 0})</h3>
            {members.loading && <Spinner size="sm" />}
            {!members.loading && members.data?.length === 0 && <p className="text-muted">No members yet.</p>}
            {!members.loading && members.data?.map((m) => (
              <div key={m.id} className="flex items-center gap-8" style={{ padding: '8px 0' }}>
                <span className="avatar avatar--sm">{m.uid?.[0]?.toUpperCase() || 'U'}</span>
                <div>
                  <div>{m.name || 'Member'}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
