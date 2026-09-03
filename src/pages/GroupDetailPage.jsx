import { useParams } from 'react-router-dom';
import ChatWorkspace from '../components/chat/ChatWorkspace';

// ---------------------------------------------------------------------------
// A group chat (/group/:id).
//
// Group-specific behaviour (members, admin controls, @mentions, announcements,
// group permissions) is configured inside the shared ChatWorkspace via
// mode="group" — same fixed layout as direct conversations:
// fixed header, scrollable message list, fixed composer.
// ---------------------------------------------------------------------------
export default function GroupDetailPage() {
  const { id } = useParams();
  return <ChatWorkspace mode="group" id={id} />;
}
