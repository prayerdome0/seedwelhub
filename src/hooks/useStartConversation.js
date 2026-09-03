import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { findOrCreateConversation } from '../services/messageService';

// Starts (or resumes) a direct conversation with another user and opens the
// thread. Powers the "Message seller" buttons on product, service and business
// pages — previously these were stubs, so buyers had no way to reach sellers
// through the app.
export default function useStartConversation() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (otherUid, { otherName = '', otherPhoto = '', product = null } = {}) => {
      if (!user) {
        showToast('Please log in to send a message.', 'info');
        navigate('/login');
        return;
      }
      if (!otherUid) {
        showToast('This listing has no seller contact yet.', 'error');
        return;
      }
      if (otherUid === user.uid) {
        showToast('This is your own listing — there is nobody to message.', 'info');
        return;
      }
      setStarting(true);
      try {
        const myName = profile?.name || user.displayName || user.email || 'You';
        const conversation = await findOrCreateConversation(user.uid, otherUid, {
          product,
          meta: {
            [`displayName_${user.uid}`]: myName,
            [`displayName_${otherUid}`]: otherName || 'User',
            [`photoURL_${otherUid}`]: otherPhoto || '',
          },
        });
        navigate(`/messages/${conversation.id}`);
      } catch (err) {
        showToast(err.message || 'Could not open the conversation. Please try again.', 'error');
      } finally {
        setStarting(false);
      }
    },
    [user, profile, showToast, navigate]
  );

  return { start, starting };
}
