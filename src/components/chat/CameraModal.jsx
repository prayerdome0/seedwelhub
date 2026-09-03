import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Spinner from '../Spinner';

// ---------------------------------------------------------------------------
// In-app camera capture. Uses getUserMedia for a live viewfinder when the
// browser allows it; browsers/devices that refuse fall back to the native
// <input capture> picker so the 📷 flow always produces a photo.
// ---------------------------------------------------------------------------

export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | live | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setStatus('starting');
    setError('');

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError('Live camera is not supported here — use the button below to pick from your camera roll.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('live');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError('Camera unavailable — check permissions, or use the picker below.');
      }
    };
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  const shoot = () => {
    const video = videoRef.current;
    if (!video || status !== 'live') return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || canvas.width * 0.75;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const ext = blob.type.split('/')[1] || 'jpeg';
        onCapture(new File([blob], `camera-${Date.now()}.${ext}`, { type: blob.type }));
      },
      'image/jpeg',
      0.9
    );
  };

  return createPortal(
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="camera-modal__card">
        <div className="camera-modal__head">
          <h3>📷 Camera</h3>
          <button type="button" className="camera-modal__close" onClick={onClose} aria-label="Close camera">
            ✕
          </button>
        </div>
        <div className="camera-modal__stage">
          <video ref={videoRef} autoPlay playsInline muted className="camera-modal__video" />
          {status === 'starting' && (
            <div className="camera-modal__overlay"><Spinner size="sm" /> <span>Starting camera…</span></div>
          )}
          {status === 'error' && (
            <div className="camera-modal__overlay camera-modal__overlay--error">
              <span aria-hidden="true">📷</span>
              <p>{error}</p>
            </div>
          )}
        </div>
        <div className="camera-modal__actions">
          <button
            type="button"
            className="camera-modal__pick"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose from device
          </button>
          <button
            type="button"
            className="camera-modal__shutter"
            onClick={shoot}
            disabled={status !== 'live'}
            aria-label="Take photo"
          >
            <span />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onCapture(file);
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
