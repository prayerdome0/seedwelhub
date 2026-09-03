import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import Avatar from '../components/Avatar';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getConversationsForUser } from '../services/messageService';
import { relativeTime } from '../utils/format';

export default function MessagesPage() {
  const { user } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getConversationsForUser(user.uid) : Promise.resolve([])),
    [user]
  );

  const otherName = (conv) => {
    const otherId = (conv.participantIds || []).find((p) => p !== user.uid);
    return otherId ? conv[`displayName_${otherId}`] || 'User' : 'Conversation';
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
            {data.map((conv) => (
              <li key={conv.id}>
                <Link to={`/messages/${conv.id}`} className="chat-list__item">
                  <Avatar src={conv.otherPhoto} name={otherName(conv)} size="md" />
                  <div className="chat-list__item-body">
                    <div className="chat-list__item-name">{otherName(conv)}</div>
                    <div className="chat-list__item-preview">
                      {conv.lastMessage || 'No messages yet'}
                      <span className="text-muted"> · {relativeTime(conv.lastMessageAt)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
