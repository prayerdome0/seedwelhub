import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// A tiny anchored popup used by the chat header's ⋮ menu and each message's
// action sheet. It renders through a portal (never clipped by the message
// list's overflow), flips up when it would leave the viewport, and closes on
// outside click / Escape / scroll.
//
// Deliberately NOT scroll-locked: the chat workspace forbids page scrolling,
// and this menu adds its own internal scroll only when taller than the screen.
// ---------------------------------------------------------------------------

export default function ChatMenu({ open, onClose, anchorRef, align = 'right', children, width = 240 }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return undefined;
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const menuHeight = menuRef.current?.offsetHeight || 300;
      let top = anchor.bottom + 6;
      if (top + Math.min(menuHeight, 420) > window.innerHeight - 8) {
        top = Math.max(8, anchor.top - Math.min(menuHeight, 420) - 6);
      }
      setPosition({
        top,
        // Fixed positioning is relative to the viewport; the portal host is
        // never inside a transformed container, so this stays correct.
        left: align === 'right' ? anchor.right : anchor.left,
        alignToRightEdge: align === 'right',
        anchorLeft: align === 'left' ? anchor.left : 0,
        maxWidth: Math.min(width, window.innerWidth - 16),
      });
    };
    update();
    // Measure once after paint too (children affect height).
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef, align, width, children]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target) &&
        anchorRef?.current && !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    // Scrolling the message list (the page's only scrollable area) detaches a
    // fixed-position menu from its anchor — close it instead. Scroll events
    // do not bubble, so listen on the capture phase. Scrolling INSIDE the
    // menu itself is left alone.
    const handleScroll = (event) => {
      if (menuRef.current && event.target instanceof Node && menuRef.current.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="chat-menu"
      style={{
        top: position.top,
        left: position.alignToRightEdge ? undefined : position.anchorLeft,
        right: position.alignToRightEdge ? Math.max(8, window.innerWidth - position.left) : undefined,
        width: position.maxWidth,
      }}
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}

/** One row inside a ChatMenu. */
export function ChatMenuItem({ icon, label, onClick, danger, disabled, hint }) {
  return (
    <button
      type="button"
      className={`chat-menu__item${danger ? ' chat-menu__item--danger' : ''}`}
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="chat-menu__icon" aria-hidden="true">{icon}</span>}
      <span className="chat-menu__label">{label}</span>
      {hint && <span className="chat-menu__hint">{hint}</span>}
    </button>
  );
}

export function ChatMenuDivider() {
  return <div className="chat-menu__divider" role="separator" />;
}

export function ChatMenuTitle({ children }) {
  return <div className="chat-menu__title">{children}</div>;
}
