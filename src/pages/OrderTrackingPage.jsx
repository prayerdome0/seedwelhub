import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import { getOrder } from '../services/orderService';
import { ORDER_STATUS_FLOW } from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/format';

export default function OrderTrackingPage() {
  const { id } = useParams();
  const { data: order, loading, error, notFound, retry } = useDocument(getOrder, id, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Order not found" message="This order does not exist." />
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status);
  const reached = currentIndex >= 0 ? currentIndex + 1 : 0;

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to={`/order/${order.id}`} className="section__link">← Back to Order</Link>
      </div>

      <div className="page__header">
        <h1 className="page__title">Track Order {order.orderNumber}</h1>
        <div className="flex gap-8">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Progress</h2>
        <div className="timeline">
          {ORDER_STATUS_FLOW.map((step, i) => {
            const done = i < reached;
            const current = i === reached - 1;
            return (
              <div key={step} className={`timeline__item ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                <span className="timeline__dot" />
                <div className="timeline__label">{step}</div>
                {current && <div className="timeline__meta">Current status</div>}
                {i === 0 && order.createdAt && (
                  <div className="timeline__meta">{formatDate(order.createdAt)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel mt-16">
        <h3 className="panel__title">Summary</h3>
        <dl className="kv">
          <dt>Order</dt><dd>{order.orderNumber}</dd>
          <dt>Business</dt><dd>{order.businessName || '—'}</dd>
          <dt>Total</dt><dd>{formatCurrency(order.total, order.currency)}</dd>
        </dl>
      </div>
    </div>
  );
}
