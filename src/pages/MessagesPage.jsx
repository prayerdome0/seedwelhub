import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import Avatar from '../components/Avatar';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getConversationsForUser } from '../services/messageService';
import { relativeTime, timestampMillis } from '../utils/format';
import { isPresenceRecent } from '../utils/chat';

// ---------------------------------------------------------------------------
// The Messages inbox. Each row gains the details the upgraded chat produces:
// an unread indicator derived from the per-user read timestamp, an online dot
// from presence heartbeats, and muted/blocked markers from conversation prefs.
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const { user } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getConversationsForUser(user.uid) : Promise.resolve([])),
    [user]
  );

  const otherIdOf = (conv) => (conv.participantIds || []).find((p) => p !== user.uid);

  const otherName = (conv) => {
    const otherId = otherIdOf(conv);
    return otherId ? conv[`displayName_${otherId}`] || 'User' : 'Conversation';
  };

  const otherPhoto = (conv) => {
    const otherId = otherIdOf(conv);
    return (otherId && conv[`photoURL_${otherId}`]) || conv.otherPhoto || '';
  };

  const isUnread = (conv) => {
    if (!conv.lastMessage || !conv.lastMessageAt) return false;
    const readAt = timestampMillis(conv.lastReadBy?.[user.uid]);
    const lastAt = timestampMillis(conv.lastMessageAt);
    return lastAt > readAt;
  };

  const isOnline = (conv) => {
    const otherId = otherIdOf(conv);
    return Boolean(otherId && isPresenceRecent(conv.presence?.[otherId]));
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Messages</h1>
        <p className="page__subtitle">Your conversations on Seedwel Hub.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState
          title="No messages yet"
          message="Start a conversation from a product, service or business page."
          action={<Link to="/marketplace" className="btn btn--primary">Browse Marketplace</Link>}
        />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="panel">
          <ul>
            {data.map((conv) => {
              const unread = isUnread(conv);
              const online = isOnline(conv);
              const muted = Boolean(conv.muted?.[user.uid]);
              const blocked = Boolean(conv.blockedBy?.[user.uid] || (otherIdOf(conv) && conv.blockedBy?.[otherIdOf(conv)]));
              return (
                <li key={conv.id}>
                  <Link
                    to={`/messages/${conv.id}`}
                    className={`chat-list__item${unread ? ' chat-list__item--unread' : ''}`}
                  >
                    <span className="chat-list__avatar-wrap">
                      <Avatar src={otherPhoto(conv)} name={otherName(conv)} size="md" />
                      {online && <i className="chat-list__online" title="Online" />}
                    </span>
                    <div className="chat-list__item-body">
                      <div className="chat-list__item-name">
                        {otherName(conv)}
                        {muted && <span className="chat-list__flag" title="Muted">🔕</span>}
                        {blocked && <span className="chat-list__flag" title="Blocked">🚫</span>}
                      </div>
                      <div className="chat-list__item-preview">
                        {conv.lastMessage || 'No messages yet'}
                        <span className="text-muted"> · {relativeTime(conv.lastMessageAt)}</span>
                      </div>
                    </div>
                    {unread && <span className="chat-list__unread" aria-label="Unread messages" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
