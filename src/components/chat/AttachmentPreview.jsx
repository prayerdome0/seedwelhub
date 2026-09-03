import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatBytes } from '../../utils/chat';
import Spinner from '../Spinner';

// ---------------------------------------------------------------------------
// Attachment preview before sending — the "check before you share" step:
//
//   [Image / video / file / location preview]
//   Add a caption…
//   Cancel | Send
//
// The file is only uploaded once the user confirms. Location sharing reuses
// the same flow with a label instead of a caption.
// ---------------------------------------------------------------------------

export default function AttachmentPreview({ attachment, uploading, onCancel, onSend }) {
  const [caption, setCaption] = useState('');
  const [label, setLabel] = useState('');
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const kind = attachment?.kind; // image | video | file | location

  useEffect(() => {
    setCaption('');
    setLabel('');
    setLocationError('');
    if (kind !== 'location') return;
    if (attachment?.location) {
      setCoords(attachment.location);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      (err) => {
        setLocationError('Could not read your location — check permissions.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [attachment, kind]);

  const objectUrl = useMemo(() => {
    if (kind === 'location' || !attachment?.file) return '';
    try {
      return URL.createObjectURL(attachment.file);
    } catch (e) {
      return '';
    }
  }, [attachment, kind]);

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl]
  );

  if (!attachment) return null;

  const ready = kind === 'location' ? Boolean(coords) && !locating : Boolean(attachment.file);

  const confirm = () => {
    if (kind === 'location') {
      onSend({ kind, location: { ...coords, label: label.trim() || 'Shared location' } });
    } else {
      onSend({ kind, file: attachment.file, caption: caption.trim() });
    }
  };

  return createPortal(
    <div className="attach-preview" role="dialog" aria-modal="true" aria-label="Attachment preview">
      <div className="attach-preview__card">
        <div className="attach-preview__head">
          <h3>
            {kind === 'image' && 'Send photo'}
            {kind === 'video' && 'Send video'}
            {kind === 'file' && 'Send document'}
            {kind === 'location' && 'Share location'}
          </h3>
          <button type="button" className="attach-preview__close" onClick={onCancel} aria-label="Cancel attachment">
            ✕
          </button>
        </div>

        <div className="attach-preview__stage">
          {kind === 'image' && objectUrl && (
            <img src={objectUrl} alt="Attachment preview" className="attach-preview__image" />
          )}
          {kind === 'video' && objectUrl && (
            <video src={objectUrl} controls className="attach-preview__video" />
          )}
          {kind === 'file' && (
            <div className="attach-preview__file">
              <span aria-hidden="true">📄</span>
              <strong>{attachment.file?.name}</strong>
              <small>{formatBytes(attachment.file?.size)}</small>
            </div>
          )}
          {kind === 'location' && (
            <div className="attach-preview__location">
              {locating && <Spinner size="sm" />}
              {locationError && <p className="attach-preview__error">{locationError}</p>}
              {coords && !locating && (
                <>
                  <span className="attach-preview__location-pin" aria-hidden="true">📍</span>
                  <strong>
                    {Number(coords.lat).toFixed(5)}, {Number(coords.lng).toFixed(5)}
                  </strong>
                  <small>Your current position</small>
                </>
              )}
            </div>
          )}
        </div>

        {kind === 'location' ? (
          <input
            className="attach-preview__caption"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name this place (e.g. Warehouse)"
            disabled={locating}
          />
        ) : (
          <input
            className="attach-preview__caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption…"
          />
        )}

        <div className="attach-preview__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={confirm}
            disabled={!ready || uploading || Boolean(locationError)}
          >
            {uploading ? <Spinner size="sm" /> : 'Send'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
