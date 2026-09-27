import { useState } from 'react';
import Button from '../Button';
import { useToast } from '../../contexts/ToastContext';

// Shared "Download PDF" action for every Seedwel Hub document.
// The PDF generator (and its ~350KB jsPDF dependency) is loaded only when the
// user actually clicks download — never on first paint.
export default function DownloadPdfButton({
  document: doc,
  label = 'Download PDF',
  variant = 'primary',
  size = 'md',
  className = '',
  block = false,
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const { generateDocumentPdf } = await import('../../documents/pdf');
      await generateDocumentPdf(doc);
      showToast('PDF downloaded.', 'success');
    } catch (err) {
      showToast(err?.message || 'Could not generate the PDF.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      loading={busy}
      onClick={handleDownload}
      className={`${block ? 'btn--block' : ''} ${className}`}
    >
      ⬇ {label}
    </Button>
  );
}
