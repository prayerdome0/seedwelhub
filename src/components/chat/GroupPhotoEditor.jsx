import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Spinner from '../Spinner';
import { isImageFile, MAX_IMAGE_BYTES } from '../../cloudinary/upload';

// ---------------------------------------------------------------------------
// "Change Group Photo" dialog — admin only.
//
// Flow: select image → preview → crop / resize (square, zoom + drag) → cancel
// or save. Saving hands a resized square Blob back to the caller, which uploads
// it and patches the EXISTING group document (never creates a new group).
//
// The crop is done entirely on a canvas in the browser, so no extra dependency
// is added and the uploaded file stays small.
// ---------------------------------------------------------------------------

const OUTPUT_SIZE = 512; // square avatar output, in px
const BOX = 260; // on-screen crop viewport, in px

export default function GroupPhotoEditor({ open, currentPhoto = '', onCancel, onSave, saving }) {
  const [file, setFile] = useState(null);
  const [src, setSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  // Reset every time the dialog is opened so a previous attempt never leaks in.
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setSrc('');
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError('');
  }, [open]);

  // Object URLs are revoked when replaced/unmounted to avoid leaking memory.
  useEffect(() => {
    if (!src || !src.startsWith('blob:')) return undefined;
    return () => URL.revokeObjectURL(src);
  }, [src]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel, saving]);

  const handleSelect = useCallback((event) => {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!isImageFile(chosen)) {
      setError('Please choose an image (JPG, PNG, WebP or GIF).');
      return;
    }
    if (chosen.size > MAX_IMAGE_BYTES) {
      setError('That image is too large. Please choose an image under 10 MB.');
      return;
    }
    setError('');
    setFile(chosen);
    setSrc(URL.createObjectURL(chosen));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const endDrag = () => {
    dragRef.current = null;
  };

  // Pointer handling for repositioning the image inside the crop viewport.
  const handlePointerDown = (event) => {
    const point = event.touches ? event.touches[0] : event;
    dragRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    const point = event.touches ? event.touches[0] : event;
    setOffset({
      x: dragRef.current.originX + (point.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (point.clientY - dragRef.current.startY),
    });
  };

  /**
   * Renders the visible crop square to a canvas at OUTPUT_SIZE and returns a
   * JPEG Blob. The maths mirrors the CSS transform used for the preview so
   * what the admin sees is exactly what is saved.
   */
  const buildCroppedBlob = () =>
    new Promise((resolve, reject) => {
      const img = imageRef.current;
      if (!img || !img.naturalWidth) {
        reject(new Error('The image is still loading. Please try again.'));
        return;
      }
      // The preview uses object-fit: cover inside a BOX×BOX viewport.
      const baseScale = Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight);
      const scale = baseScale * zoom;
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const left = (BOX - drawW) / 2 + offset.x;
      const top = (BOX - drawH) / 2 + offset.y;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      const ratio = OUTPUT_SIZE / BOX;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.drawImage(img, left * ratio, top * ratio, drawW * ratio, drawH * ratio);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not process the image. Please try another one.'));
        },
        'image/jpeg',
        0.9
      );
    });

  const handleSave = async () => {
    try {
      setError('');
      const blob = await buildCroppedBlob();
      const cropped = new File([blob], `group-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      await onSave(cropped);
    } catch (err) {
      setError(err.message || 'Could not save the group photo.');
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="report-dialog" role="dialog" aria-modal="true" aria-label="Change group photo">
      <div className="report-dialog__card group-photo">
        <h3 className="group-photo__title">Change Group Photo</h3>

        {!src && (
          <>
            <div className="group-photo__current">
              {currentPhoto ? (
                <img src={currentPhoto} alt="Current group photo" />
              ) : (
                <span aria-hidden="true">👥</span>
              )}
            </div>
            <p className="chat-aside__note">
              Choose a square image for the best result. Max 10 MB.
            </p>
          </>
        )}

        {src && (
          <>
            <div
              className="group-photo__crop"
              style={{ width: BOX, height: BOX }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={endDrag}
            >
              <img
                ref={imageRef}
                src={src}
                alt="Group photo preview"
                draggable={false}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
              <span className="group-photo__mask" aria-hidden="true" />
            </div>
            <label className="group-photo__zoom">
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <p className="chat-aside__note">Drag the image to reposition it.</p>
          </>
        )}

        <label className="group-photo__pick btn btn--secondary btn--sm">
          {src ? 'Choose a different image' : 'Select image'}
          <input type="file" accept="image/*" onChange={handleSelect} hidden />
        </label>

        {error && <p className="form__msg form__msg--error">{error}</p>}

        <div className="report-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={!file || saving}
          >
            {saving ? <Spinner size="sm" /> : 'Save photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
