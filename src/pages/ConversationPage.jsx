import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Avatar from '../components/Avatar';
import Image from '../components/Image';
import Spinner from '../components/Spinner';
import { ErrorState, NotFoundState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getConversation, getMessages, sendMessage, markConversationRead } from '../services/messageService';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import { relativeTime } from '../utils/format';

export default function ConversationPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: conversation, loading, error, notFound, retry } = useAsync(
    () => getConversation(id),
    [id]
  );
  const messages = useAsync(
    () => (conversation ? getMessages(conversation.id) : Promise.resolve([])),
    [conversation]
  );
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (conversation) {
      markConversationRead(conversation.id, user.uid).catch(() => {});
    }
  }, [conversation, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data?.length]);

  if (loading) return <div className="container page"><Spinner size="large" /></div>;
  if (error) return <div className="container page"><ErrorState message={error} onRetry={retry} /></div>;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Conversation not found" message="This conversation does not exist." />
      </div>
    );
  }

  const otherId = (conversation.participantIds || []).find((p) => p !== user.uid);
  const otherName = conversation[`displayName_${otherId}`] || 'User';

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendMessage({
        conversationId: conversation.id,
        senderId: user.uid,
        text: trimmed,
        type: 'text',
      });
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
      await sendMessage({
        conversationId: conversation.id,
        senderId: user.uid,
        text: '',
        type: 'image',
        mediaUrl: result.secureUrl,
      });
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
        <Link to="/messages" className="section__link">← Back to Messages</Link>
      </div>

      <div className="chat-layout">
        <div className="chat-list">
          <div className="chat-list__header">{otherName}</div>
          <p className="text-muted" style={{ padding: '12px 16px', fontSize: 13 }}>
            Start messaging with this user.
          </p>
        </div>

        <div className="chat-window">
          <div className="chat-window__header">
            <Avatar name={otherName} size="sm" />
            <span className="chat-window__header-title">{otherName}</span>
          </div>
          <div className="chat-window__body">
            {messages.loading && <Spinner size="sm" />}
            {!messages.loading && messages.data?.length === 0 && (
              <p className="text-muted text-center">No messages yet. Say hello!</p>
            )}
            {!messages.loading && messages.data?.map((m) => {
              const own = m.senderId === user.uid;
              return (
                <div key={m.id} className={`chat-bubble ${own ? 'chat-bubble--own' : ''}`}>
                  {m.type === 'image' && m.mediaUrl && (
                    <div className="chat-bubble__media"><Image src={m.mediaUrl} alt="Shared image" /></div>
                  )}
                  {m.text && <div>{m.text}</div>}
                  <div className="chat-bubble__meta">{relativeTime(m.createdAt)}</div>
                </div>
              );
            })}
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
            <button type="button" className="chat-window__send" onClick={handleSend} disabled={sending || !text.trim()} aria-label="Send">
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
