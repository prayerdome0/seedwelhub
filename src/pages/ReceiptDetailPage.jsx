import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import { getReceipt } from '../services/receiptService';
import { formatCurrency, formatDate } from '../utils/format';

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const { data: r, loading, error, notFound, retry } = useDocument(getReceipt, id, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Receipt not found" message="This receipt does not exist." />
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/receipts" className="section__link">← Back to Receipts</Link>
      </div>

      <div className="doc-marksheet">
        <div className="doc-marksheet__head">
          <span className="doc-marksheet__title">Receipt {r.receiptNumber}</span>
          <StatusBadge status={r.status} />
        </div>
        <div className="doc-marksheet__body">
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Business</span><span className="doc-marksheet__value">{r.businessName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Customer</span><span className="doc-marksheet__value">{r.customerName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Amount</span><span className="doc-marksheet__value">{formatCurrency(r.amount)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Payment method</span><span className="doc-marksheet__value">{r.paymentMethod || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Payment reference</span><span className="doc-marksheet__value">{r.paymentReference || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Date</span><span className="doc-marksheet__value">{formatDate(r.createdAt)}</span></div>
          {r.orderId && (
            <div className="doc-marksheet__row"><span className="doc-marksheet__label">Order</span><span className="doc-marksheet__value"><Link to={`/order/${r.orderId}`} className="table__link">View order</Link></span></div>
          )}
        </div>
      </div>

      {r.verificationCode && (
        <div className="panel mt-16">
          <h2 className="panel__title">Verification</h2>
          <p className="text-muted">Verify this document: <Link to={`/verify/${r.verificationCode}`} className="table__link">/verify/{r.verificationCode}</Link></p>
        </div>
      )}
    </div>
  );
}
