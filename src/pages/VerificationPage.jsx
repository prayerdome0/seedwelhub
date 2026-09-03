import { useParams, Link } from 'react-router-dom';
import { WATERMARK_LOGO } from '../assets';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getQuotationByVerificationCode } from '../services/quotationService';
import { getInvoiceByVerificationCode } from '../services/invoiceService';
import { getReceiptByVerificationCode } from '../services/receiptService';
import { formatDate, formatCurrency } from '../utils/format';

// Public document-verification page. Only exposes limited, non-private data.
export default function VerificationPage() {
  const { code } = useParams();

  const { data, loading, error, retry } = useAsync(async () => {
    const [quotation, invoice, receipt] = await Promise.all([
      getQuotationByVerificationCode(code),
      getInvoiceByVerificationCode(code),
      getReceiptByVerificationCode(code),
    ]);
    if (quotation.length > 0) {
      return { type: 'quotation', document: quotation[0] };
    }
    if (invoice.length > 0) {
      return { type: 'invoice', document: invoice[0] };
    }
    if (receipt.length > 0) {
      return { type: 'receipt', document: receipt[0] };
    }
    return null;
  }, [code]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) {
    return (
      <div className="container page">
        <NotFoundState
          title="Verification not found"
          message="This verification code is invalid or the document no longer exists."
        />
      </div>
    );
  }

  const { type, document: doc } = data;
  const numberField =
    type === 'quotation' ? doc.quotationNumber : type === 'invoice' ? doc.invoiceNumber : doc.receiptNumber;

  return (
    <div className="container page">
      <div className="page__header page__header--center">
        <h1 className="page__title">Document Verification</h1>
        <p className="page__subtitle">Verify the authenticity of this Xacheus document.</p>
      </div>

      <div className="doc-marksheet" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="doc-marksheet__head">
          <img loading="lazy" decoding="async" src={WATERMARK_LOGO} alt="Xacheus" />
          <span className="doc-marksheet__title">Verification Result</span>
          <StatusBadge status="verified" label="Verified" />
        </div>
        <div className="doc-marksheet__body">
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Document type</span><span className="doc-marksheet__value">{type}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Document number</span><span className="doc-marksheet__value">{numberField}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Business</span><span className="doc-marksheet__value">{doc.businessName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Date</span><span className="doc-marksheet__value">{formatDate(doc.createdAt)}</span></div>
          {(type === 'quotation' || type === 'invoice') && doc.total !== undefined && (
            <div className="doc-marksheet__row"><span className="doc-marksheet__label">Total</span><span className="doc-marksheet__value">{formatCurrency(doc.total)}</span></div>
          )}
          {type === 'receipt' && doc.amount !== undefined && (
            <div className="doc-marksheet__row"><span className="doc-marksheet__label">Amount</span><span className="doc-marksheet__value">{formatCurrency(doc.amount)}</span></div>
          )}
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Status</span><span className="doc-marksheet__value"><StatusBadge status={doc.status} /></span></div>
        </div>
      </div>

      <div className="text-center mt-24">
        <Link to="/" className="btn btn--primary">Go to Xacheus</Link>
      </div>
    </div>
  );
}
