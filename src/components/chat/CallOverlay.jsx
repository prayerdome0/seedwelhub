import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../Avatar';
import { formatDuration } from '../../utils/chat';

// ---------------------------------------------------------------------------
// Voice / video call overlay.
//
// WebRTC signalling is not wired up yet, so the overlay behaves as an honest
// UI scaffold: it shows the ringing state, an elapsed timer, and — for video
// calls — the local camera preview when the browser grants it. Ending the call
// always cleans the camera stream up.
// ---------------------------------------------------------------------------

export default function CallOverlay({ call, onClose }) {
  const { name, photo, video } = call || {};
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!call) return undefined;
    const connectTimer = window.setTimeout(() => setConnected(true), 2500);
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      window.clearTimeout(connectTimer);
      window.clearInterval(tick);
    };
  }, [call]);

  useEffect(() => {
    let cancelled = false;
    if (!call || !video) return undefined;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not support camera preview.');
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setCameraError('Camera unavailable — check permissions.');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [call, video]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape' && call) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [call, onClose]);

  if (!call) return null;

  return createPortal(
    <div className="call-overlay" role="dialog" aria-modal="true" aria-label={`Call with ${name}`}>
      <div className="call-overlay__card">
        <div className={`call-overlay__stage${video ? ' call-overlay__stage--video' : ''}`}>
          {video && !cameraError && (
            <video ref={videoRef} autoPlay playsInline muted className="call-overlay__video" />
          )}
          {video && cameraError && <div className="call-overlay__camera-error">{cameraError}</div>}
          {!video && <Avatar src={photo} name={name} size="lg" />}
        </div>
        <h3 className="call-overlay__name">{name}</h3>
        <p className="call-overlay__status" aria-live="polite">
          {connected ? (
            <>
              {video ? 'Video' : 'Voice'} call · {formatDuration(elapsed)}
              <span className="call-overlay__note"> — preview: signalling connects both sides in a future release</span>
            </>
          ) : (
            'Calling…'
          )}
        </p>
        <div className="call-overlay__actions">
          <button
            type="button"
            className={`call-overlay__btn${micMuted ? ' call-overlay__btn--active' : ''}`}
            onClick={() => setMicMuted((m) => !m)}
            aria-pressed={micMuted}
            aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {micMuted ? '🔇' : '🎙️'}
          </button>
          <button
            type="button"
            className="call-overlay__btn call-overlay__btn--end"
            onClick={onClose}
            aria-label="End call"
          >
            📞
          </button>
          {video && (
            <button
              type="button"
              className="call-overlay__btn"
              onClick={() => setCameraError((e) => e || '')}
              aria-label="Switch camera"
              title="Switch camera"
            >
              🔄
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
