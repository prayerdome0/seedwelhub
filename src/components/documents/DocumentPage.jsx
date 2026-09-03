import { Link } from 'react-router-dom';
import DocumentView from './DocumentView';
import DownloadPdfButton from './DownloadPdfButton';

// Wraps a rendered document with the standard back-link, action bar and
// print support. Used by the receipt / invoice / quotation / payment / order
// document screens so they all behave identically.
export default function DocumentPage({
  document: doc,
  backTo,
  backLabel = 'Back',
  actions,
  children,
}) {
  return (
    <div className="container page">
      <div className="doc-page__bar">
        {backTo && (
          <Link to={backTo} className="section__link">← {backLabel}</Link>
        )}
        <div className="doc-page__actions">
          {actions}
          <DownloadPdfButton document={doc} />
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => window.print()}
          >
            🖨 Print
          </button>
        </div>
      </div>

      <DocumentView document={doc} />

      {children && <div className="doc-page__extra">{children}</div>}
    </div>
  );
}
