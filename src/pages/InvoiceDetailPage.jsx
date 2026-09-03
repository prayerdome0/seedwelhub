import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import { getInvoice } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/format';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { data: inv, loading, error, notFound, retry } = useDocument(getInvoice, id, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Invoice not found" message="This invoice does not exist." />
      </div>
    );
  }

  const items = inv.items || [];

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/invoices" className="section__link">← Back to Invoices</Link>
      </div>

      <div className="doc-marksheet">
        <div className="doc-marksheet__head">
          <span className="doc-marksheet__title">Invoice {inv.invoiceNumber}</span>
          <StatusBadge status={inv.status} />
        </div>
        <div className="doc-marksheet__body">
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Business</span><span className="doc-marksheet__value">{inv.businessName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Customer</span><span className="doc-marksheet__value">{inv.customerName || '—'}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Date</span><span className="doc-marksheet__value">{formatDate(inv.createdAt)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Due date</span><span className="doc-marksheet__value">{formatDate(inv.dueDate)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Total</span><span className="doc-marksheet__value">{formatCurrency(inv.total)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Amount paid</span><span className="doc-marksheet__value">{formatCurrency(inv.amountPaid)}</span></div>
          <div className="doc-marksheet__row"><span className="doc-marksheet__label">Balance</span><span className="doc-marksheet__value">{formatCurrency(inv.balance)}</span></div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="panel mt-16">
          <h2 className="panel__title">Items</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Amount</th></tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td>{it.name || `Item ${idx + 1}`}</td>
                    <td>{it.quantity}</td>
                    <td>{formatCurrency(it.unitPrice)}</td>
                    <td>{formatCurrency(it.discount)}</td>
                    <td>{it.tax ? `${it.tax}%` : '—'}</td>
                    <td>{formatCurrency((Number(it.unitPrice) || 0) * (Number(it.quantity) || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inv.notes && (
        <div className="panel mt-16">
          <h2 className="panel__title">Notes</h2>
          <p className="text-muted">{inv.notes}</p>
        </div>
      )}

      {inv.verificationCode && (
        <div className="panel mt-16">
          <h2 className="panel__title">Verification</h2>
          <p className="text-muted">Verify this document: <Link to={`/verify/${inv.verificationCode}`} className="table__link">/verify/{inv.verificationCode}</Link></p>
        </div>
      )}
    </div>
  );
}
