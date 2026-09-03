import { useParams } from 'react-router-dom';
import ChatWorkspace from '../components/chat/ChatWorkspace';

// ---------------------------------------------------------------------------
// A direct conversation (/messages/:id).
//
// The page is a thin wrapper: every piece of messaging behaviour lives in the
// shared ChatWorkspace so direct chats and groups stay perfectly in step.
// The workspace locks the layout — fixed header, fixed composer, and the
// message list as the only scrollable area on the page.
// ---------------------------------------------------------------------------
export default function ConversationPage() {
  const { id } = useParams();
  return <ChatWorkspace mode="direct" id={id} />;
}
