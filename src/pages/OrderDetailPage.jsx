import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import { getOrder } from '../services/orderService';
import { formatCurrency, formatDate } from '../utils/format';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { data: order, loading, error, notFound, retry } = useDocument(getOrder, id, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Order not found" message="This order does not exist or you do not have access to it." />
      </div>
    );
  }

  const items = order.items || [];
  const timeline = true;

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/orders" className="section__link">← Back to Orders</Link>
      </div>

      <div className="page__header">
        <h1 className="page__title">Order {order.orderNumber}</h1>
        <p className="page__subtitle">Placed {formatDate(order.createdAt)}</p>
        <div className="flex gap-8">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} label={`Payment: ${order.paymentStatus}`} />
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <div className="panel">
            <h2 className="panel__title">Items</h2>
            {items.length === 0 ? (
              <p className="text-muted">No items found for this order.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td>{it.name || `Item ${idx + 1}`}</td>
                        <td>{it.quantity}</td>
                        <td>{formatCurrency(it.price)}</td>
                        <td>{formatCurrency((Number(it.price) || 0) * (Number(it.quantity) || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {timeline && (
            <div className="panel">
              <h2 className="panel__title">Order Timeline</h2>
              <div className="timeline">
                {['Order Placed', 'Payment Submitted', 'Payment Confirmed', 'Processing', 'Ready', 'Shipped', 'Out for Delivery', 'Delivered'].map((step) => {
                  const done = order.status === step;
                  return (
                    <div key={step} className={`timeline__item ${done ? 'current' : ''}`}>
                      <span className="timeline__dot" />
                      <div className="timeline__label">{step}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h3 className="panel__title">Summary</h3>
            <dl className="kv">
              <dt>Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd>
              <dt>Delivery</dt><dd>{formatCurrency(order.deliveryFee)}</dd>
              <dt>Total</dt><dd>{formatCurrency(order.total)}</dd>
              <dt>Payment</dt><dd>{order.paymentStatus}</dd>
            </dl>
            <div className="mt-16">
              <Link to={`/order/${order.id}/tracking`} className="btn btn--primary btn--block">Track Order</Link>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel__title">Details</h3>
            <dl className="kv">
              {order.businessName && (<><dt>Business</dt><dd>{order.businessName}</dd></>)}
              {order.buyerName && (<><dt>Buyer</dt><dd>{order.buyerName}</dd></>)}
              {order.address && (<><dt>Delivery</dt><dd>{order.address}</dd></>)}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
