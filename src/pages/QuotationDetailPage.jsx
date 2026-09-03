import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import { getQuotation } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/format';

export default function QuotationDetailPage() {
  const { id } = useParams();
  const { data: q, loading, error, notFound, retry } = useDocument(getQuotation, id, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Quotation not found" message="This quotation does not exist." />
      </div>
    );
  }

  const items = q.items || [];

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/quotations" className="section__link">← Back to Quotations</Link>
      </div>

      <div className="doc-marksheet">
        <div className="doc-marksheet__head">
          <span className="doc-marksheet__title">Quotation {q.quotationNumber}</span>
          <StatusBadge status={q.status} />
        </div>
        <div className="doc-marksheet__body">
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Business</span><span className="doc-marksheet__value">{q.businessName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Customer</span><span className="doc-marksheet__value">{q.customerName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Date</span><span className="doc-marksheet__value">{formatDate(q.createdAt)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Valid until</span><span className="doc-marksheet__value">{formatDate(q.validUntil)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Total</span><span className="doc-marksheet__value">{formatCurrency(q.total)}</span></div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="panel mt-16">
          <h2 className="panel__title">Items</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td>{it.name || `Item ${idx + 1}`}</td>
                    <td>{it.quantity}</td>
                    <td>{formatCurrency(it.unitPrice)}</td>
                    <td>{formatCurrency((Number(it.unitPrice) || 0) * (Number(it.quantity) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {q.notes && (
        <div className="panel mt-16">
          <h2 className="panel__title">Notes</h2>
          <p className="text-muted">{q.notes}</p>
        </div>
      )}

      {q.verificationCode && (
        <div className="panel mt-16">
          <h2 className="panel__title">Verification</h2>
          <p className="text-muted">Verify this document: <Link to={`/verify/${q.verificationCode}`} className="table__link">/verify/{q.verificationCode}</Link></p>
        </div>
      )}
    </div>
  );
}
