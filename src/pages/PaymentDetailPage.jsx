import { Link, useParams } from 'react-router-dom';
import Image from '../components/Image';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import { getPayment } from '../services/paymentService';
import { getOrder } from '../services/orderService';
import useAsync from '../hooks/useAsync';
import { formatCurrency, formatDate } from '../utils/format';

export default function PaymentDetailPage() {
  const { id } = useParams();
  const { data: payment, loading, error, notFound, retry } = useDocument(getPayment, id, []);
  const order = useAsync(
    () => (payment?.orderId ? getOrder(payment.orderId) : Promise.resolve(null)),
    [payment]
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Payment not found" message="This payment record does not exist." />
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/payments" className="section__link">← Back to Payments</Link>
      </div>

      <div className="page__header">
        <h1 className="page__title">Payment {payment.reference}</h1>
        <div className="flex gap-8"><StatusBadge status={payment.status} /></div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {payment.proofUrl && (
            <div className="panel">
              <h2 className="panel__title">Payment Proof</h2>
              <Image src={payment.proofUrl} alt="Payment proof" className="w-full" />
            </div>
          )}

          {order.data && (
            <div className="panel">
              <h2 className="panel__title">Related Order</h2>
              <dl className="kv">
                <dt>Order</dt>
                <dd><Link to={`/order/${order.data.id}`} className="table__link">{order.data.orderNumber}</Link></dd>
              </dl>
            </div>
          )}
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h3 className="panel__title">Summary</h3>
            <dl className="kv">
              <dt>Amount</dt><dd>{formatCurrency(payment.amount)}</dd>
              <dt>Method</dt><dd>{payment.method || '—'}</dd>
              <dt>Reference</dt><dd>{payment.reference}</dd>
              <dt>Date</dt><dd>{formatDate(payment.paidAt || payment.createdAt)}</dd>
              <dt>Status</dt><dd><StatusBadge status={payment.status} /></dd>
            </dl>
          </div>

          {payment.note && (
            <div className="panel">
              <h3 className="panel__title">Note</h3>
              <p className="text-muted">{payment.note}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
