import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen product image viewer.
 *
 * Distinct from the chat `Lightbox`: this one carries a gallery, so a shopper
 * can page through every photo of a product without leaving the viewer.
 *
 * - Escape closes; ← / → move between images.
 * - Clicking the backdrop closes; clicking the photo itself does not.
 * - Locks body scroll while open so the page behind cannot drift.
 */
export default function ImageLightbox({ images = [], startIndex = 0, alt = '', onClose }) {
  const list = images.filter(Boolean);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => setIndex(startIndex), [startIndex]);

  const next = useCallback(
    () => setIndex((i) => (i + 1) % list.length),
    [list.length]
  );
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + list.length) % list.length),
    [list.length]
  );

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'ArrowRight' && list.length > 1) next();
      if (event.key === 'ArrowLeft' && list.length > 1) prev();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, next, prev, list.length]);

  if (!list.length) return null;

  return createPortal(
    <div
      className="lightbox lightbox--gallery"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Product image'}
    >
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close image viewer">
        ✕
      </button>

      <div className="lightbox__stage" onClick={onClose}>
        <img
          src={list[index]}
          alt={`${alt}${list.length > 1 ? ` — image ${index + 1} of ${list.length}` : ''}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {list.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--prev"
            onClick={prev}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox__nav lightbox__nav--next"
            onClick={next}
            aria-label="Next image"
          >
            ›
          </button>
          <div className="lightbox__counter">{index + 1} / {list.length}</div>
          <div className="lightbox__thumbs">
            {list.map((img, i) => (
              <button
                key={i}
                type="button"
                className={`lightbox__thumb ${i === index ? 'is-active' : ''}`}
                onClick={() => setIndex(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
              >
                <img src={img} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
