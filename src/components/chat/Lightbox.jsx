import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Full-screen image viewer for shared photos. Closes on backdrop click and
// Escape; deliberately never scrolls the page behind it.
export default function Lightbox({ src, caption, onClose }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!src) return null;

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close preview">
        ✕
      </button>
      <div className="lightbox__stage" onClick={onClose}>
        <img src={src} alt={caption || 'Shared image'} onClick={(e) => e.stopPropagation()} />
      </div>
      {caption && <p className="lightbox__caption">{caption}</p>}
    </div>,
    document.body
  );
}
