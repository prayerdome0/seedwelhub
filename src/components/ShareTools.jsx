import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '../contexts/ToastContext';

function absoluteUrl(url) {
  if (typeof window === 'undefined') return url;
  try { return new URL(url, window.location.origin).toString(); }
  catch { return window.location.href; }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Clipboard is unavailable.');
}

export default function ShareTools({
  url,
  title = 'Seedwel Hub',
  description = '',
  showQr = false,
  onShared,
  compact = false,
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const canvasRef = useRef(null);
  const { showToast } = useToast();
  const link = absoluteUrl(url);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: description, url: link });
        onShared?.();
        return;
      }
      await copyText(link);
      onShared?.();
      showToast('Link copied. Share it anywhere.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      showToast('Could not share this link. Please copy it and try again.', 'error');
    }
  };

  const copy = async () => {
    try {
      await copyText(link);
      onShared?.();
      showToast('Link copied to clipboard.', 'success');
    } catch {
      showToast('Could not copy the link. Please try again.', 'error');
    }
  };

  const downloadQr = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const download = document.createElement('a');
    download.href = canvas.toDataURL('image/png');
    download.download = `${String(title || 'seedwel-share').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;
    download.click();
  };

  return (
    <div className={`share-tools ${compact ? 'share-tools--compact' : ''}`}>
      <button type="button" className="btn btn--primary btn--sm" onClick={share}>
        <span aria-hidden="true">↗</span> Share
      </button>
      <button type="button" className="btn btn--outline btn--sm" onClick={copy}>
        Copy link
      </button>
      {showQr && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setQrOpen((open) => !open)}
          aria-expanded={qrOpen}
        >
          ▦ {qrOpen ? 'Hide QR' : 'QR code'}
        </button>
      )}
      {qrOpen && showQr && (
        <div className="share-qr" role="region" aria-label={`QR code for ${title}`}>
          <div className="share-qr__canvas">
            <QRCodeCanvas
              ref={canvasRef}
              value={link}
              size={220}
              level="H"
              includeMargin
              fgColor="#0f1f33"
              bgColor="#ffffff"
            />
          </div>
          <div className="share-qr__copy">
            <strong>Scan to open this {title.toLowerCase().includes('store') ? 'store' : 'page'}</strong>
            <span>{link}</span>
            <button type="button" className="btn btn--secondary btn--sm" onClick={downloadQr}>
              Download QR as PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
