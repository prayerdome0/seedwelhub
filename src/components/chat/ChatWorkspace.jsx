import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Avatar from '../Avatar';
import Drawer from '../Drawer';
import Spinner from '../Spinner';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';
import AttachmentPreview from './AttachmentPreview';
import CameraModal from './CameraModal';
import ForwardDialog from './ForwardDialog';
import CallOverlay from './CallOverlay';
import Lightbox from './Lightbox';
import {
  GroupSettingsForm,
  InfoPanel,
  MediaPanel,
  MembersPanel,
  MessageListPanel,
  ReportDialog,
  SearchPanel,
  SidePanel,
} from './ChatPanels';
import {
  editMessage,
  deleteMessage,
  getConversation,
  getConversationsForUser,
  getMessages,
  markConversationRead,
  markMessagesDelivered,
  markMessagesRead,
  reportConversation,
  reportMessage,
  sendMessage,
  setConversationBlocked,
  setConversationMuted,
  setConversationPresence,
  setConversationTyping,
  setPinnedMessage,
  setReactions,
  clearConversation,
  toggleStarMessage,
} from '../../services/messageService';
import {
  addGroupMember,
  demoteFromAdmin,
  getGroup,
  getGroupMembers,
  getGroupMessages,
  getGroupsWhereMember,
  joinGroup,
  leaveGroup,
  promoteToAdmin,
  removeGroupMember,
  reportGroup,
  sendGroupMessage,
  setGroupPresence,
  setGroupTyping,
  setGroupAnnouncement,
  setMemberGroupMuted,
  updateGroupSettings,
} from '../../services/groupService';
import { uploadToCloudinary, validateUploadFile } from '../../cloudinary/upload';
import { friendlyError } from '../../utils/firebaseErrors';
import {
  MESSAGE_TYPES,
  fileMessages,
  mediaMessages,
  messagePreview,
  pinnedMessages,
  searchMessages as searchMessagesUtil,
  starredBy,
  toggleReactionMap,
  typingNames as typingNamesUtil,
} from '../../utils/chat';

// ---------------------------------------------------------------------------
// ChatWorkspace — the fixed messaging surface shared by direct conversations
// (/messages/:id) and groups (/group/:id).
//
// Layout contract (a strict Seedwel Hub requirement):
//
//   ┌──────────────── chat-app (100% of viewport minus site header) ────────┐
//   │ chat-header   — always fixed, always visible                          │
//   │ chat-body     — the ONLY scrollable element on the page               │
//   │ chat-composer — always fixed at the bottom, never pushed off-screen   │
//   └───────────────────────────────────────────────────────────────────────┘
//
// Everything else (panels, dialogs, drawers, lightbox, calls) renders as
// overlays inside this frame; the page body never scrolls.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 6000;
const PRESENCE_INTERVAL_MS = 45000;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB for generic documents

let optimisticCounter = 0;
const nextOptimisticId = () => `pending-${Date.now()}-${++optimisticCounter}`;

function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', onConfirm, onClose, busy }) {
  if (!open) return null;
  return (
    <div className="report-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="report-dialog__card report-dialog__card--slim">
        <div className="report-dialog__head">
          <h3>{title}</h3>
          <button type="button" className="report-dialog__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="report-dialog__body-text">{body}</p>
        <div className="report-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner size="sm" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatWorkspace({ mode = 'direct', id }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const listRef = useRef(null);

  // ---- feed state ------------------------------------------------------------
  const [meta, setMeta] = useState(null); // conversation or group document
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState(null);
  const [members, setMembers] = useState([]); // group membership docs
  const [pendingMessages, setPendingMessages] = useState([]);
  const pollTimer = useRef(null);
  const pollingRef = useRef(false);

  // ---- UI state ---------------------------------------------------------------
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [attachment, setAttachment] = useState(null); // { kind, file?, location? }
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [panel, setPanel] = useState(null); // search | media | starred | pinned | info | members | settings
  const [searchTerm, setSearchTerm] = useState('');
  const [newCount, setNewCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  // True once the message list has performed its initial placement and
  // reported where the viewer actually landed. Read receipts must not fire on
  // a stale "at bottom" assumption while the thread is still positioning.
  const [listSettled, setListSettled] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [call, setCall] = useState(null);
  const [forwardMessageState, setForwardMessageState] = useState(null);
  const [forwardTargets, setForwardTargets] = useState([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [reportState, setReportState] = useState(null); // { target: 'message'|'group', message? }
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState(null); // { kind, message? }
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItems, setDrawerItems] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [announcementHidden, setAnnouncementHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const myName = profile?.name || user?.displayName || user?.email || 'You';
  const viewerId = user?.uid;

  // ============================================================================
  // Polling feed — messages + conversation/group meta + group members.
  // ============================================================================
  const poll = useCallback(async () => {
    if (!id || !viewerId || pollingRef.current) return;
    pollingRef.current = true;
    try {
      let metaDoc = null;
      if (mode === 'direct') {
        metaDoc = await getConversation(id);
      } else {
        metaDoc = await getGroup(id);
      }
      if (!metaDoc) {
        setNotFound(true);
        setMetaLoading(false);
        return;
      }
      setNotFound(false);
      setMetaError(null);
      setMeta(metaDoc);

      const [freshMessages, freshMembers] = await Promise.all([
        mode === 'direct' ? getMessages(id) : getGroupMessages(id),
        mode === 'group' ? getGroupMembers(id) : Promise.resolve([]),
      ]);
      setMembers(freshMembers);
      setMessages(freshMessages);
      setMessagesError(null);

      // Reconcile optimistic sends: drop pendings whose server copy arrived.
      const serverClientIds = new Set(freshMessages.map((m) => m.clientId).filter(Boolean));
      setPendingMessages((prev) =>
        prev.filter((p) => !serverClientIds.has(p.clientId))
      );

      // Delivery receipts: anything incoming I have fetched is delivered to me.
      markMessagesDelivered(freshMessages, viewerId).catch(() => {});
    } catch (err) {
      setMetaError(friendlyError(err));
      setMessagesError(friendlyError(err));
    } finally {
      pollingRef.current = false;
      setMetaLoading(false);
      setMessagesLoading(false);
    }
  }, [id, mode, viewerId]);

  useEffect(() => {
    poll();
    pollTimer.current = window.setInterval(() => {
      // Skip polling while the tab is hidden — no wasted reads.
      if (!document.hidden) poll();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(pollTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  // Presence heartbeat — "online" on the other side is a fresh timestamp.
  useEffect(() => {
    if (!id || !viewerId || notFound) return undefined;
    const beat = () =>
      (mode === 'direct' ? setConversationPresence(id, viewerId) : setGroupPresence(id, viewerId)).catch(
        () => {}
      );
    beat();
    const timer = window.setInterval(beat, PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [id, mode, viewerId, notFound]);

  // ---------------------------------------------------------------------------
  // THE fixed-workspace rule: while a chat is open the document itself may not
  // scroll. Only the message list (.chat-body) is scrollable. Toggling a body
  // class lets the global layout (header/main/footer) clamp to the viewport.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    document.body.classList.add('chat-workspace-open');
    return () => document.body.classList.remove('chat-workspace-open');
  }, []);

  // Read receipts — only once the list has settled AND the viewer is actually
  // at the bottom of the thread. Opening a conversation on its unread divider
  // keeps the messages below unread until the viewer scrolls down to them.
  useEffect(() => {
    if (!viewerId || !listSettled || !atBottom || messagesLoading || notFound) return;
    const unreadIncoming = messages.filter(
      (m) => m.senderId !== viewerId && !(m.readBy || []).includes(viewerId)
    );
    if (!unreadIncoming.length) return;
    markMessagesRead(messages, viewerId)
      .then(() => (mode === 'direct' ? markConversationRead(id, viewerId) : null))
      .then(() => poll())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, atBottom, viewerId, messagesLoading, notFound, listSettled, mode, id, poll]);

  // ---------------------------------------------------------------------------
  // Thread switch — reset transient state DURING render (the React-endorsed
  // "derive state from props" pattern) so the keyed message list never mounts
  // on the previous thread's content and no stale scroll callback can leak
  // "new message" counts or read receipts across threads.
  // ---------------------------------------------------------------------------
  const threadKey = `${mode}:${id}`;
  const lastThreadRef = useRef(threadKey);
  if (lastThreadRef.current !== threadKey) {
    lastThreadRef.current = threadKey;
    setReplyTo(null);
    setEditing(null);
    setPanel(null);
    setSearchTerm('');
    setNewCount(0);
    setAtBottom(true);
    setListSettled(false);
    setPendingMessages([]);
    setAnnouncementHidden(false);
    setMessagesLoading(true);
    setMetaLoading(true);
    setNotFound(false);
    setMessages([]);
  }

  // ============================================================================
  // Derived participants / status.
  // ============================================================================
  const memberName = useCallback(
    (uid) => {
      if (!uid) return '';
      if (uid === viewerId) return myName;
      if (mode === 'direct') {
        return meta?.[`displayName_${uid}`] || 'User';
      }
      const member = members.find((m) => m.uid === uid);
      return member?.name || (uid === meta?.creatorId ? 'Group creator' : 'Member');
    },
    [meta, members, mode, myName, viewerId]
  );

  const direct = mode === 'direct';
  const otherId = direct
    ? (meta?.participantIds || []).find((p) => p !== viewerId) || null
    : null;
  const otherName = direct ? memberName(otherId) : '';
  const otherPhoto = direct ? meta?.[`photoURL_${otherId}`] || meta?.otherPhoto || '' : '';

  const viewerMember = members.find((m) => m.uid === viewerId);
  const viewerIsAdmin = !direct
    ? Boolean(meta && (meta.creatorId === viewerId || (meta.adminIds || []).includes(viewerId) || viewerMember?.role === 'admin'))
    : false;
  const isMember = direct || Boolean(viewerMember);

  const memberNamesList = useMemo(
    () => members.map((m) => memberName(m.uid)).filter(Boolean),
    [members, memberName]
  );

  const otherIds = useMemo(() => {
    if (direct) return otherId ? [otherId] : [];
    return members.map((m) => m.uid).filter((uid) => uid !== viewerId);
  }, [direct, otherId, members, viewerId]);

  const membersById = useMemo(() => {
    const map = {};
    if (direct) {
      if (otherId) map[otherId] = { name: otherName, photo: otherPhoto };
      if (viewerId) map[viewerId] = { name: myName };
      return map;
    }
    for (const m of members) {
      map[m.uid] = {
        name: m.name || memberName(m.uid),
        isAdmin: m.role === 'admin' || m.uid === meta?.creatorId,
      };
    }
    if (viewerId && !map[viewerId]) map[viewerId] = { name: myName };
    return map;
  }, [direct, members, memberName, meta, otherId, otherName, otherPhoto, myName, viewerId]);

  const onlineUids = useMemo(() => {
    const presence = meta?.presence || {};
    const now = Date.now();
    return Object.entries(presence)
      .filter(([uid, ts]) => uid !== viewerId && ts && now - (ts.toMillis ? ts.toMillis() : Number(ts)) < 90000)
      .map(([uid]) => uid);
  }, [meta, viewerId]);

  const typingNamesList = useMemo(() => {
    const map = meta?.typing || {};
    const now = Date.now();
    return typingNamesUtil(map, viewerId, (uid) => memberName(uid), now);
  }, [meta, viewerId, memberName]);

  const typingLabel = typingNamesList.length
    ? direct
      ? `${otherName} is typing`
      : `${typingNamesList.slice(0, 2).join(', ')}${typingNamesList.length > 2 ? ' + others are' : typingNamesList.length > 1 ? ' are' : ' is'} typing`
    : '';

  const title = direct ? otherName : meta?.name || 'Group';
  const avatarSrc = direct ? otherPhoto : meta?.image || '';

  const muted = direct
    ? Boolean(meta?.muted?.[viewerId])
    : Boolean(viewerMember?.muted);

  const blockedByMe = direct ? Boolean(meta?.blockedBy?.[viewerId]) : false;
  const blockedByOther = direct ? Boolean(otherId && meta?.blockedBy?.[otherId]) : false;

  const pinned = useMemo(() => pinnedMessages(messages), [messages]);
  const latestPinned = pinned[pinned.length - 1] || null;
  const starred = useMemo(() => starredBy(messages, viewerId), [messages, viewerId]);
  const media = useMemo(() => mediaMessages(messages), [messages]);
  const files = useMemo(() => fileMessages(messages), [messages]);
  const searchResults = useMemo(() => searchMessagesUtil(messages, searchTerm), [messages, searchTerm]);

  const subtitle = direct
    ? typingLabel
      ? ''
      : onlineUids.includes(otherId)
        ? 'Online'
        : 'Offline'
    : `${meta?.memberCount || members.length} members${onlineUids.length ? ` · ${onlineUids.length} online` : ''}`;

  const canSend = isMember && !blockedByMe && !blockedByOther && user
    ? direct || meta?.permissions?.whoCanSend !== 'admins' || viewerIsAdmin
    : false;
  const disabledReason = !user
    ? 'Log in to send messages'
    : blockedByOther
      ? 'You can no longer send messages in this conversation.'
      : blockedByMe
        ? 'You blocked this user. Unblock to send messages.'
        : !isMember
          ? 'Join this group to send messages.'
          : !direct && meta?.permissions?.whoCanSend === 'admins' && !viewerIsAdmin
            ? 'Only group admins can send messages here.'
            : '';

  // ============================================================================
  // Sending.
  // ============================================================================
  const pushPending = useCallback((payload) => {
    const clientId = `c${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const pending = {
      id: nextOptimisticId(),
      clientId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      text: payload.text || '',
      type: payload.type || MESSAGE_TYPES.TEXT,
      mediaUrl: payload.mediaUrl || '',
      mediaName: payload.mediaName || '',
      location: payload.location || null,
      replyTo: payload.replyTo || null,
      replyPreview: payload.replyPreview || '',
      forwarded: Boolean(payload.forwarded),
      createdAt: Date.now(),
      readBy: [payload.senderId],
      deliveredTo: [payload.senderId],
      reactions: {},
      starredBy: [],
      pending: true,
    };
    setPendingMessages((prev) => [...prev, pending]);
    return clientId;
  }, []);

  const doSend = useCallback(
    async (payload) => {
      const clientId = pushPending(payload);
      try {
        if (direct) {
          await sendMessage({ conversationId: id, ...payload, clientId });
          // Your own send counts as read — keeps the inbox unread badge honest.
          markConversationRead(id, viewerId).catch(() => {});
        } else {
          await sendGroupMessage({ groupId: id, ...payload, clientId });
        }
      } catch (err) {
        showToast(friendlyError(err) || 'Could not send the message.', 'error');
      } finally {
        setPendingMessages((prev) => prev.filter((p) => p.clientId !== clientId));
        poll();
      }
    },
    [direct, id, pushPending, poll, showToast, viewerId]
  );

  const sendText = useCallback(
    (text, options = {}) => {
      const payload = {
        senderId: viewerId,
        senderName: myName,
        text: options.type === MESSAGE_TYPES.STICKER ? options.text : text,
        type: options.type || MESSAGE_TYPES.TEXT,
        ...(replyTo
          ? { replyTo: replyTo.id, replyPreview: messagePreview(replyTo), replySenderName: memberName(replyTo.senderId) }
          : {}),
        ...options,
      };
      setReplyTo(null);
      return doSend(payload);
    },
    [doSend, memberName, myName, replyTo, viewerId]
  );

  const sendVoice = useCallback(
    async (blob, durationMs) => {
      try {
        const ext = (blob.type.split('/')[1] || 'webm').split(';')[0];
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        const result = await uploadToCloudinary(file, { resourceType: 'video' });
        await doSend({
          senderId: viewerId,
          senderName: myName,
          type: MESSAGE_TYPES.VOICE,
          text: '',
          mediaUrl: result.secureUrl,
          durationMs,
          ...(replyTo ? { replyTo: replyTo.id, replyPreview: messagePreview(replyTo) } : {}),
        });
        setReplyTo(null);
        showToast('Voice message sent.', 'success');
      } catch (err) {
        showToast(friendlyError(err) || 'Voice upload failed.', 'error');
      }
    },
    [doSend, myName, replyTo, showToast, viewerId]
  );

  const handleAttachmentSend = useCallback(
    async ({ kind, file, caption, location }) => {
      setUploadingAttachment(true);
      try {
        let payload = {
          senderId: viewerId,
          senderName: myName,
          text: caption || '',
        };
        if (kind === 'location') {
          payload = { ...payload, type: MESSAGE_TYPES.LOCATION, location };
        } else {
          const resourceType =
            kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'raw';
          if (kind === 'file' && file.size > MAX_FILE_BYTES) {
            showToast('Documents must be 25 MB or smaller.', 'error');
            return;
          }
          if (kind !== 'file') validateUploadFile(file); // images/videos: size + type guard
          const result = await uploadToCloudinary(file, { resourceType });
          payload = {
            ...payload,
            type: kind === 'image' ? MESSAGE_TYPES.IMAGE : kind === 'video' ? MESSAGE_TYPES.VIDEO : MESSAGE_TYPES.FILE,
            mediaUrl: result.secureUrl,
            mediaName: file.name,
            mediaSize: file.size,
          };
        }
        if (replyTo) {
          payload.replyTo = replyTo.id;
          payload.replyPreview = messagePreview(replyTo);
        }
        setReplyTo(null);
        setAttachment(null);
        await doSend(payload);
      } catch (err) {
        showToast(friendlyError(err) || 'Upload failed.', 'error');
      } finally {
        setUploadingAttachment(false);
      }
    },
    [doSend, myName, replyTo, showToast, viewerId]
  );

  const handleTypingChange = useCallback(
    (typing) => {
      if (!viewerId) return;
      (direct ? setConversationTyping(id, viewerId, typing) : setGroupTyping(id, viewerId, typing)).catch(
        () => {}
      );
    },
    [direct, id, viewerId]
  );

  // ============================================================================
  // Message actions.
  // ============================================================================
  const handleReply = useCallback((message) => {
    setEditing(null);
    setReplyTo({
      ...message,
      name: memberName(message.senderId),
    });
  }, [memberName]);

  const handleEditSave = useCallback(
    async (message, text) => {
      setBusy(true);
      try {
        await editMessage(message, text);
        setEditing(null);
        showToast('Message updated.', 'success');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not edit the message.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [poll, showToast]
  );

  const handleDelete = useCallback(
    async (message) => {
      setBusy(true);
      try {
        await deleteMessage(message);
        showToast('Message deleted.', 'info');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not delete the message.', 'error');
      } finally {
        setBusy(false);
        setConfirmState(null);
      }
    },
    [poll, showToast]
  );

  const handleReact = useCallback(
    async (message, emoji) => {
      try {
        // Optimistic toggle through the shared, verified helper.
        const next = toggleReactionMap(message.reactions, viewerId, emoji);
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: next } : m)));
        await setReactions(message, next);
      } catch (err) {
        showToast(friendlyError(err) || 'Could not save the reaction.', 'error');
      }
    },
    [showToast, viewerId]
  );

  const handleStar = useCallback(
    async (message, starred) => {
      try {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? { ...m, starredBy: starred ? [...(m.starredBy || []), viewerId] : (m.starredBy || []).filter((u) => u !== viewerId) }
              : m
          )
        );
        await toggleStarMessage(message, viewerId, starred);
        showToast(starred ? 'Added to starred messages.' : 'Removed from starred messages.', 'info');
      } catch (err) {
        showToast(friendlyError(err) || 'Could not update the star.', 'error');
      }
    },
    [showToast, viewerId]
  );

  const handlePin = useCallback(
    async (message, pinnedFlag) => {
      try {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, pinned: pinnedFlag } : m)));
        await setPinnedMessage(message, pinnedFlag, viewerId);
        showToast(pinnedFlag ? 'Message pinned.' : 'Message unpinned.', 'info');
      } catch (err) {
        showToast(friendlyError(err) || 'Could not update the pin.', 'error');
      }
    },
    [showToast, viewerId]
  );

  const handleCopy = useCallback(
    (payload) => {
      const value = String(payload || '').trim();
      if (!value) return;
      const done = () => showToast('Copied to clipboard.', 'success');
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).then(done, () => fallbackCopy(value, done));
      } else {
        fallbackCopy(value, done);
      }
    },
    [showToast]
  );

  // ---- forward ---------------------------------------------------------------
  const openForward = useCallback(async (message) => {
    setForwardMessageState(message);
    setForwardLoading(true);
    try {
      const [conversations, groups] = await Promise.all([
        getConversationsForUser(viewerId),
        getGroupsWhereMember(viewerId),
      ]);
      const targets = [
        ...conversations
          .map((c) => {
            const other = (c.participantIds || []).find((p) => p !== viewerId);
            return {
              kind: 'direct',
              id: c.id,
              title: c[`displayName_${other}`] || 'User',
              photo: c[`photoURL_${other}`] || '',
            };
          }),
        ...groups.map((g) => ({
          kind: 'group',
          id: g.id,
          title: g.name,
          photo: g.image || '',
          subtitle: `${g.memberCount || 0} members`,
        })),
      ];
      setForwardTargets(targets);
    } catch (err) {
      showToast(friendlyError(err) || 'Could not load conversations.', 'error');
    } finally {
      setForwardLoading(false);
    }
  }, [direct, id, showToast, viewerId]);

  const handleForward = useCallback(
    async (target) => {
      const message = forwardMessageState;
      if (!message) return;
      const payload = {
        senderId: viewerId,
        senderName: myName,
        text: message.text || '',
        type: message.type,
        mediaUrl: message.mediaUrl || '',
        mediaName: message.mediaName || '',
        mediaSize: message.mediaSize || 0,
        durationMs: message.durationMs || 0,
        location: message.location || null,
        forwarded: true,
      };
      try {
        if (target.kind === 'direct') {
          await sendMessage({ conversationId: target.id, ...payload });
        } else {
          await sendGroupMessage({ groupId: target.id, ...payload });
        }
        setForwardMessageState(null);
        showToast(`Forwarded to ${target.title}.`, 'success');
      } catch (err) {
        showToast(friendlyError(err) || 'Could not forward the message.', 'error');
      }
    },
    [forwardMessageState, myName, showToast, viewerId]
  );

  // ---- report ----------------------------------------------------------------
  const submitReport = useCallback(
    async ({ reason, note }) => {
      setReportSubmitting(true);
      try {
        if (reportState?.target === 'group') {
          await reportGroup({ group: meta, reporterId: viewerId, reason, note });
        } else if (reportState?.target === 'conversation') {
          await reportConversation({ conversation: meta, reporterId: viewerId, reason, note });
        } else if (reportState?.message) {
          await reportMessage({ message: reportState.message, reporterId: viewerId, reason, note });
        }
        setReportState(null);
        showToast('Report submitted. Thank you for keeping Seedwel Hub safe.', 'success');
      } catch (err) {
        showToast(friendlyError(err) || 'Could not submit the report.', 'error');
      } finally {
        setReportSubmitting(false);
      }
    },
    [meta, reportState, showToast, viewerId]
  );

  // ---- conversation / group level actions ------------------------------------
  const toggleMute = useCallback(async () => {
    try {
      if (direct) {
        await setConversationMuted(id, viewerId, !muted);
      } else if (viewerMember) {
        await setMemberGroupMuted(viewerMember, !muted);
      }
      showToast(muted ? 'Notifications unmuted.' : 'Conversation muted.', 'info');
      poll();
    } catch (err) {
      showToast(friendlyError(err) || 'Could not update notifications.', 'error');
    }
  }, [direct, id, muted, poll, showToast, viewerId, viewerMember]);

  const toggleBlock = useCallback(async () => {
    try {
      await setConversationBlocked(id, viewerId, !blockedByMe);
      showToast(blockedByMe ? 'User unblocked.' : 'User blocked.', 'info');
      poll();
    } catch (err) {
      showToast(friendlyError(err) || 'Could not update the block.', 'error');
    }
  }, [blockedByMe, id, poll, showToast, viewerId]);

  const handleClear = useCallback(async () => {
    setBusy(true);
    try {
      await clearConversation(id);
      showToast('Conversation cleared.', 'info');
      setConfirmState(null);
      poll();
    } catch (err) {
      showToast(friendlyError(err) || 'Could not clear the conversation.', 'error');
    } finally {
      setBusy(false);
    }
  }, [id, poll, showToast]);

  const handleJoinGroup = useCallback(async () => {
    setBusy(true);
    try {
      await joinGroup(id, viewerId, { name: myName });
      await sendGroupMessage({
        groupId: id,
        senderId: viewerId,
        senderName: myName,
        type: MESSAGE_TYPES.SYSTEM,
        text: `${myName} joined the group`,
      });
      showToast('Joined group!', 'success');
      poll();
    } catch (err) {
      showToast(friendlyError(err) || 'Could not join the group.', 'error');
    } finally {
      setBusy(false);
    }
  }, [id, myName, poll, showToast, viewerId]);

  const handleLeaveGroup = useCallback(async () => {
    setBusy(true);
    try {
      await leaveGroup(id, viewerId);
      showToast('Left group.', 'info');
      navigate('/groups');
    } catch (err) {
      showToast(friendlyError(err) || 'Could not leave the group.', 'error');
      setBusy(false);
    }
  }, [id, navigate, showToast, viewerId]);

  const handleAddMember = useCallback(
    async (uid, name) => {
      setBusy(true);
      try {
        await addGroupMember(meta, uid, { name, addedBy: viewerId });
        await sendGroupMessage({
          groupId: id,
          senderId: viewerId,
          senderName: myName,
          type: MESSAGE_TYPES.SYSTEM,
          text: `${myName} added ${name || 'a new member'}`,
        });
        showToast('Member added.', 'success');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not add the member.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [id, meta, myName, poll, showToast, viewerId]
  );

  const handleRemoveMember = useCallback(
    async (member) => {
      setBusy(true);
      try {
        await removeGroupMember(meta, member, viewerId);
        await sendGroupMessage({
          groupId: id,
          senderId: viewerId,
          senderName: myName,
          type: MESSAGE_TYPES.SYSTEM,
          text: `${myName} removed ${member.name || 'a member'}`,
        });
        showToast('Member removed.', 'info');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not remove the member.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [id, meta, myName, poll, showToast, viewerId]
  );

  const handlePromote = useCallback(
    async (member) => {
      try {
        await promoteToAdmin(meta, member, viewerId);
        await sendGroupMessage({
          groupId: id,
          senderId: viewerId,
          senderName: myName,
          type: MESSAGE_TYPES.SYSTEM,
          text: `${member.name || 'A member'} is now an admin`,
        });
        showToast('Member promoted to admin.', 'success');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not promote the member.', 'error');
      }
    },
    [id, meta, myName, poll, showToast, viewerId]
  );

  const handleDemote = useCallback(
    async (member) => {
      try {
        await demoteFromAdmin(meta, member, viewerId);
        showToast('Admin rights removed.', 'info');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not demote the admin.', 'error');
      }
    },
    [meta, poll, showToast, viewerId]
  );

  const handleSaveGroupSettings = useCallback(
    async (data) => {
      setBusy(true);
      try {
        await updateGroupSettings(meta, data, viewerId);
        showToast('Group settings saved.', 'success');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not save settings.', 'error');
      } finally {
        setBusy(false);
      }
    },
    [meta, poll, showToast, viewerId]
  );

  const handleSetAnnouncement = useCallback(
    async (text) => {
      try {
        await setGroupAnnouncement(meta, text, viewerId);
        showToast(text.trim() ? 'Announcement updated.' : 'Announcement cleared.', 'info');
        poll();
      } catch (err) {
        showToast(friendlyError(err) || 'Could not update the announcement.', 'error');
      }
    },
    [meta, poll, showToast, viewerId]
  );

  // ---- ☰ drawer: quick thread switch ------------------------------------------
  const openDrawer = useCallback(async () => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      if (direct) {
        const conversations = await getConversationsForUser(viewerId);
        setDrawerItems(
          conversations.map((c) => {
            const other = (c.participantIds || []).find((p) => p !== viewerId);
            return {
              to: `/messages/${c.id}`,
              title: c[`displayName_${other}`] || 'User',
              photo: c[`photoURL_${other}`] || '',
              preview: c.lastMessage || 'No messages yet',
              active: c.id === id,
            };
          })
        );
      } else {
        const groups = await getGroupsWhereMember(viewerId);
        setDrawerItems(
          groups.map((g) => ({
            to: `/group/${g.id}`,
            title: g.name,
            photo: g.image || '',
            preview: g.lastMessage || `${g.memberCount || 0} members`,
            active: g.id === id,
          }))
        );
      }
    } catch (err) {
      setDrawerItems([]);
    } finally {
      setDrawerLoading(false);
    }
  }, [direct, id, viewerId]);

  // ---- scroll helpers ----------------------------------------------------------
  const jumpToMessage = useCallback(
    (messageId) => {
      if (!listRef.current) return;
      const found = listRef.current.scrollToMessage(messageId);
      // e.g. a quoted reply whose original is older than the loaded window.
      if (!found) showToast('That message is not loaded in this view.', 'info');
    },
    [showToast]
  );

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToBottom('smooth');
    setNewCount(0);
    setAtBottom(true);
  }, []);

  const messageById = useCallback(
    (messageId) => messages.find((m) => m.id === messageId) || null,
    [messages]
  );

  const resolveReply = useCallback(
    (replyToId) => {
      const original = messageById(replyToId);
      if (!original) return null;
      return { ...original, senderName: memberName(original.senderId) };
    },
    [memberName, messageById]
  );

  // ============================================================================
  // Header menu (⋮) and rendering.
  // ============================================================================
  const headerMenuItems = useMemo(() => {
    const items = [
      { icon: '🔍', label: 'Search', onClick: () => setPanel('search') },
      { icon: '🖼️', label: 'Media & files', onClick: () => setPanel('media') },
      { icon: '★', label: 'Starred messages', onClick: () => setPanel('starred') },
      { icon: '📌', label: 'Pinned messages', onClick: () => setPanel('pinned') },
      { icon: '🔔', label: 'Notifications', onClick: () => setPanel('settings') },
      {
        icon: muted ? '🔕' : '🔔',
        label: muted ? 'Unmute conversation' : 'Mute conversation',
        onClick: toggleMute,
      },
      { divider: true },
    ];
    if (direct) {
      items.push(
        { icon: '🚫', label: blockedByMe ? 'Unblock user' : 'Block user', onClick: toggleBlock, danger: !blockedByMe },
        { icon: '🧹', label: 'Clear conversation', onClick: () => setConfirmState({ kind: 'clear' }), danger: true },
        { icon: '🚩', label: 'Report', onClick: () => setReportState({ target: 'conversation' }), danger: true },
        { icon: '⚙️', label: 'Conversation settings', onClick: () => setPanel('settings') }
      );
    } else {
      items.push(
        { icon: 'ℹ️', label: 'Group info', onClick: () => setPanel('info') },
        { icon: '👥', label: `Members (${members.length})`, onClick: () => setPanel('members') },
        { icon: '➕', label: 'Add members', onClick: () => setPanel('members'), disabled: !viewerIsAdmin },
        { icon: '🔔', label: 'Group notification settings', onClick: () => setPanel('settings') },
        { icon: '⚙️', label: 'Group settings', onClick: () => setPanel('settings'), disabled: !viewerIsAdmin },
        { icon: '📢', label: 'Group announcement', onClick: () => setPanel('settings'), disabled: !viewerIsAdmin },
        { icon: '🛡️', label: 'Group permissions', onClick: () => setPanel('settings'), disabled: !viewerIsAdmin },
        { icon: '🚪', label: 'Leave group', onClick: handleLeaveGroup, danger: true },
        { icon: '🚩', label: 'Report group', onClick: () => setReportState({ target: 'group' }), danger: true }
      );
    }
    return items;
  }, [blockedByMe, direct, handleLeaveGroup, members.length, muted, toggleBlock, toggleMute, viewerIsAdmin]);

  // ---- panels ------------------------------------------------------------------
  const closePanel = useCallback(() => {
    setPanel(null);
    setSearchTerm('');
  }, []);

  const jumpFromPanel = useCallback(
    (messageId) => {
      closePanel();
      jumpToMessage(messageId);
    },
    [closePanel, jumpToMessage]
  );

  const renderPanel = () => {
    if (!panel) return null;
    const titles = {
      search: 'Search conversation',
      media: 'Media & files',
      starred: 'Starred messages',
      pinned: 'Pinned messages',
      info: direct ? 'Conversation info' : 'Group info',
      members: 'Group members',
      settings: direct ? 'Conversation settings' : 'Group settings',
    };
    return (
      <SidePanel title={titles[panel]} onClose={closePanel}>
        {panel === 'search' && (
          <SearchPanel
            term={searchTerm}
            onTermChange={setSearchTerm}
            results={searchResults}
            onJump={jumpFromPanel}
          />
        )}
        {panel === 'media' && (
          <MediaPanel
            media={media}
            files={files}
            onJump={jumpFromPanel}
            onOpenImage={(src, caption) => setLightbox({ src, caption })}
          />
        )}
        {panel === 'starred' && (
          <MessageListPanel
            messages={starred}
            onJump={jumpFromPanel}
            emptyHint="Star a message (⋮ menu → Star message) to find it here later."
          />
        )}
        {panel === 'pinned' && (
          <MessageListPanel
            messages={[...pinned].reverse()}
            onJump={jumpFromPanel}
            emptyHint="Pin important messages to keep them at hand for everyone."
          />
        )}
        {panel === 'info' && (
          <InfoPanel
            title={title}
            avatarSrc={avatarSrc}
            rows={
              direct
                ? [
                    { label: 'Status', value: onlineUids.includes(otherId) ? '🟢 Online' : '⚪ Offline' },
                    { label: 'Muted', value: muted ? 'Yes' : 'No' },
                    { label: 'Messages', value: String(messages.length) },
                    { label: 'Media', value: `${media.length} photos/videos · ${files.length} documents` },
                  ]
                : [
                    { label: 'Members', value: String(meta?.memberCount || members.length) },
                    { label: 'Admins', value: String((meta?.adminIds || [meta?.creatorId]).filter(Boolean).length) },
                    { label: 'Visibility', value: meta?.visibility || 'public' },
                    { label: 'Category', value: meta?.category || '—' },
                    { label: 'Media', value: `${media.length} photos/videos · ${files.length} documents` },
                  ]
            }
            actions={
              direct
                ? [
                    { icon: '🖼️', label: 'Media & files', onClick: () => setPanel('media') },
                    { icon: '🚫', label: blockedByMe ? 'Unblock user' : 'Block user', onClick: toggleBlock },
                  ]
                : isMember
                  ? [{ icon: '👥', label: 'View members', onClick: () => setPanel('members') }]
                  : [{ icon: '➕', label: 'Join group', onClick: handleJoinGroup, primary: true, disabled: busy }]
            }
          >
            {direct && meta?.sharedProductId && (
              <p className="chat-aside__note">This conversation started from a marketplace listing.</p>
            )}
            {!direct && meta?.description && <p className="chat-aside__desc">{meta.description}</p>}
          </InfoPanel>
        )}
        {panel === 'members' && (
          <MembersPanel
            members={members}
            viewerId={viewerId}
            viewerIsAdmin={viewerIsAdmin}
            onlineUids={onlineUids}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onPromote={handlePromote}
            onDemote={handleDemote}
            onLeave={handleLeaveGroup}
            adding={busy}
            busy={busy}
          />
        )}
        {panel === 'settings' &&
          (direct ? (
            <InfoPanel
              title="Conversation settings"
              avatarSrc={avatarSrc}
              rows={[
                { label: 'Notifications', value: muted ? '🔕 Muted' : '🔔 On' },
                { label: 'Blocked', value: blockedByMe ? 'Yes' : 'No' },
                { label: 'Messages', value: String(messages.length) },
              ]}
              actions={[
                { icon: muted ? '🔔' : '🔕', label: muted ? 'Unmute notifications' : 'Mute notifications', onClick: toggleMute },
                { icon: '🚫', label: blockedByMe ? 'Unblock user' : 'Block user', onClick: toggleBlock },
                { icon: '🚩', label: 'Report conversation', onClick: () => setReportState({ target: 'conversation' }), danger: true },
              ]}
            >
              <div className="chat-aside__actions">
                <DangerButtonFlow
                  label="Clear conversation"
                  confirmBody="This deletes every message in this conversation for both sides. This cannot be undone."
                  confirmLabel="Clear everything"
                  onConfirm={handleClear}
                  busy={busy}
                />
              </div>
            </InfoPanel>
          ) : (
            <GroupSettingsForm
              group={meta || {}}
              viewerIsAdmin={viewerIsAdmin}
              saving={busy}
              muted={muted}
              onToggleMute={toggleMute}
              onSave={handleSaveGroupSettings}
              onSetAnnouncement={handleSetAnnouncement}
            />
          ))}
      </SidePanel>
    );
  };

  // ---- guards -------------------------------------------------------------------
  if (metaLoading && !meta) {
    return (
      <div className="chat-app chat-app--loading">
        <Spinner size="large" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="chat-app chat-app--state">
        <div className="chat-state">
          <span aria-hidden="true">💬</span>
          <h3>Conversation not found</h3>
          <p>This conversation does not exist or was removed.</p>
          <Link className="btn btn--primary" to={direct ? '/messages' : '/groups'}>
            Back to {direct ? 'Messages' : 'Groups'}
          </Link>
        </div>
      </div>
    );
  }
  if (metaError && !meta) {
    return (
      <div className="chat-app chat-app--state">
        <div className="chat-state">
          <span aria-hidden="true">⚠️</span>
          <h3>Could not load the chat</h3>
          <p>{metaError}</p>
          <button type="button" className="btn btn--secondary" onClick={() => poll()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const announcement = !direct && meta?.announcement?.text && !announcementHidden ? meta.announcement : null;

  return (
    <div className="chat-app">
      {/* Fixed while messages scroll underneath */}
      <ChatHeader
        title={title}
        subtitle={subtitle}
        typingLabel={typingLabel}
        avatarSrc={avatarSrc}
        muted={muted}
        pinnedMessage={latestPinned}
        menuItems={headerMenuItems}
        onOpenMenuDrawer={openDrawer}
        onOpenInfo={() => setPanel('info')}
        onToggleMute={toggleMute}
        onStartCall={(video) => setCall({ video, name: title, photo: avatarSrc })}
        onUnpin={() => latestPinned && handlePin(latestPinned, false)}
        onJumpToMessage={jumpToMessage}
      />

      {/* Group announcements banner */}
      {announcement && (
        <div className="chat-announcement" role="status">
          <span aria-hidden="true">📢</span>
          <p>{announcement.text}</p>
          <button type="button" onClick={() => setAnnouncementHidden(true)} aria-label="Hide announcement">
            ✕
          </button>
        </div>
      )}

      {/* Block / join banners */}
      {direct && (blockedByMe || blockedByOther) && (
        <div className="chat-banner chat-banner--warning">
          <span aria-hidden="true">🚫</span>
          <p>
            {blockedByMe
              ? 'You blocked this user. They cannot message you until you unblock.'
              : 'You can no longer send messages in this conversation.'}
          </p>
          {blockedByMe && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={toggleBlock}>
              Unblock
            </button>
          )}
        </div>
      )}
      {!direct && !isMember && (
        <div className="chat-banner chat-banner--join">
          <span aria-hidden="true">👥</span>
          <p>You are viewing this group as a guest.</p>
          <button type="button" className="btn btn--primary btn--sm" onClick={handleJoinGroup} disabled={busy}>
            {busy ? <Spinner size="sm" /> : 'Join group'}
          </button>
        </div>
      )}

      <MessageList
        ref={listRef}
        key={`${mode}-${id || 'new'}`}
        messages={messages}
        pendingMessages={pendingMessages}
        viewerId={viewerId}
        otherIds={otherIds}
        memberNames={memberNamesList}
        membersById={membersById}
        mode={mode}
        searchTerm={panel === 'search' ? searchTerm : ''}
        replyToMessage={resolveReply}
        typingLabel={typingLabel}
        loading={messagesLoading}
        error={messagesError}
        onRetry={poll}
        emptyHint={direct ? 'No messages yet. Say hello!' : 'No messages yet. Be the first to say hello!'}
        onReply={handleReply}
        onReact={handleReact}
        onCopy={handleCopy}
        onForward={openForward}
        onStar={handleStar}
        onPin={handlePin}
        onEdit={(message) => {
          setReplyTo(null);
          setEditing(message);
        }}
        onDelete={(message) => setConfirmState({ kind: 'delete', message })}
        onReport={(message) => setReportState({ target: 'message', message })}
        onOpenImage={(src, caption) => setLightbox({ src, caption })}
        onAtBottomChange={(bottom) => {
          setAtBottom(bottom);
          // The first report is the list's initial placement — from here on
          // the at-bottom state is real and read receipts may fire.
          setListSettled(true);
          if (bottom) setNewCount(0);
        }}
        onNewMessages={(freshCount, incomingCount) =>
          // Only INCOMING messages count as "new" — the viewer's own sends
          // while scrolled up must not inflate the pill.
          setNewCount((n) => n + (incomingCount || 0))
        }
        onMessageVisible={() => setNewCount(0)}
      />

      {/* "↓ N new messages" — never yank the reader to the bottom */}
      {!atBottom && (
        <button type="button" className="chat-jump-latest" onClick={jumpToLatest} aria-live="polite">
          {newCount > 0 ? `↓ ${newCount} new message${newCount === 1 ? '' : 's'}` : '↓ Latest'}
        </button>
      )}

      <ChatComposer
        mode={mode}
        placeholder={direct ? 'Type a message…' : 'Message the group…'}
        disabled={!canSend}
        disabledReason={disabledReason}
        replyTo={replyTo ? { name: replyTo.name, preview: messagePreview(replyTo) } : null}
        editing={editing}
        sending={busy}
        onSendText={sendText}
        onEditSave={handleEditSave}
        onSendVoice={sendVoice}
        onAttachFile={(file, kind) => setAttachment({ kind, file })}
        onShareLocation={() => setAttachment({ kind: 'location' })}
        onOpenCamera={() => setCameraOpen(true)}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onTypingChange={handleTypingChange}
        onNotify={(message, type) => showToast(message, type)}
        mentionCandidates={
          !direct
            ? members
                .filter((m) => m.uid !== viewerId && (m.name || memberName(m.uid)))
                .map((m) => ({ uid: m.uid, name: m.name || memberName(m.uid), isAdmin: m.role === 'admin' }))
            : []
        }
      />

      {renderPanel()}

      <AttachmentPreview
        attachment={attachment}
        uploading={uploadingAttachment}
        onCancel={() => setAttachment(null)}
        onSend={handleAttachmentSend}
      />

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setCameraOpen(false);
          setAttachment({ kind: 'image', file });
        }}
      />

      <ForwardDialog
        open={Boolean(forwardMessageState)}
        targets={forwardTargets.filter((t) => !(t.kind === (direct ? 'direct' : 'group') && t.id === id))}
        loading={forwardLoading}
        message={forwardMessageState}
        onClose={() => setForwardMessageState(null)}
        onForward={handleForward}
      />

      <ReportDialog
        open={Boolean(reportState)}
        title={reportState?.target === 'group' ? 'Report group' : 'Report message'}
        onClose={() => setReportState(null)}
        onSubmit={submitReport}
        submitting={reportSubmitting}
      />

      <ConfirmDialog
        open={confirmState?.kind === 'delete'}
        title="Delete message?"
        body="The message will be removed for everyone in this conversation."
        confirmLabel="Delete"
        busy={busy}
        onClose={() => setConfirmState(null)}
        onConfirm={() => confirmState?.message && handleDelete(confirmState.message)}
      />

      <ConfirmDialog
        open={confirmState?.kind === 'clear'}
        title="Clear conversation?"
        body="This deletes every message in this conversation for both sides. This cannot be undone."
        confirmLabel="Clear"
        busy={busy}
        onClose={() => setConfirmState(null)}
        onConfirm={handleClear}
      />

      <Lightbox src={lightbox?.src} caption={lightbox?.caption} onClose={() => setLightbox(null)} />
      <CallOverlay call={call} onClose={() => setCall(null)} />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={direct ? 'Conversations' : 'My groups'} side="left">
        <div className="chat-drawer">
          <Link to={direct ? '/messages' : '/groups'} className="chat-drawer__hub">
            ← All {direct ? 'messages' : 'groups'}
          </Link>
          {drawerLoading && <Spinner size="sm" />}
          {!drawerLoading && drawerItems.length === 0 && (
            <p className="chat-drawer__empty">Nothing else yet.</p>
          )}
          {drawerItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`chat-drawer__item${item.active ? ' chat-drawer__item--active' : ''}`}
              onClick={() => setDrawerOpen(false)}
            >
              <Avatar src={item.photo} name={item.title} size="sm" />
              <span className="chat-drawer__body">
                <strong>{item.title}</strong>
                <small>{item.preview}</small>
              </span>
            </Link>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

// Clipboard fallback for browsers without the async clipboard API.
function fallbackCopy(value, done) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    done();
  } catch (e) {
    // silently give up — copy is best-effort
  }
}

// Clear-conversation button with inline confirmation (used in settings panel).
function DangerButtonFlow({ label, confirmBody, confirmLabel, onConfirm, busy }) {
  const [arming, setArming] = useState(false);
  if (arming) {
    return (
      <div className="chat-aside__confirm">
        <small>{confirmBody}</small>
        <button type="button" className="btn btn--danger btn--sm" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setArming(false)}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="btn btn--danger-outline btn--sm" onClick={() => setArming(true)}>
      🧹 {label}
    </button>
  );
}
