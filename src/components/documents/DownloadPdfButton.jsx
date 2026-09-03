import { useState } from 'react';
import Button from '../Button';
import { useToast } from '../../contexts/ToastContext';
import { generateDocumentPdf } from '../../documents/pdf';

// Shared "Download PDF" action for every Xacheus document.
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
