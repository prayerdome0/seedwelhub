import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// A reusable slide-in side panel used by both the main menu and the account
// menu.
//
// Behaviour details that matter:
//  - Renders in a portal so it is never clipped by a parent's overflow.
//  - Locks background scroll while open, and restores the exact scroll
//    position on close (no page jump).
//  - Closes on Escape and on backdrop click.
//  - Returns focus to the trigger when dismissed.
//  - The panel itself is the only scroll area, and only when the menu is
//    genuinely taller than the viewport.
// ---------------------------------------------------------------------------
export default function Drawer({
  open,
  onClose,
  title,
  side = 'left',
  header,
  footer,
  children,
  labelledBy = 'drawer-title',
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      // Simple focus trap so keyboard users cannot tab behind the panel.
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector('[data-drawer-autofocus]')?.focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="drawer-root">
      <div className="drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`drawer drawer--${side}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className="drawer__head">
          {header || <h2 className="drawer__title" id={labelledBy}>{title}</h2>}
          <button
            type="button"
            className="drawer__close"
            onClick={onClose}
            aria-label="Close menu"
            data-drawer-autofocus
          >
            ✕
          </button>
        </div>

        <div className="drawer__body">{children}</div>

        {footer && <div className="drawer__foot">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}
