import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import PaymentInstructions from '../components/payments/PaymentInstructions';
import PaymentProofForm from '../components/payments/PaymentProofForm';
import PaymentProofList from '../components/payments/PaymentProofList';
import DownloadPdfButton from '../components/documents/DownloadPdfButton';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import { getOrder } from '../services/orderService';
import { getBusiness } from '../services/businessService';
import { getReceiptByOrder } from '../services/receiptService';
import { getInvoiceByOrder } from '../services/invoiceService';
import { getProofsByOrder } from '../services/paymentProofService';
import { buildDocument } from '../documents/model';
import { useAuth } from '../contexts/AuthContext';
import {
  DOCUMENT_TYPES,
  ORDER_STATUS_FLOW,
  PAYMENT_STATUS,
  PROOF_STATUS,
} from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/format';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: order, loading, error, notFound, retry } = useDocument(getOrder, id, []);
  const [payOpen, setPayOpen] = useState(false);

  const business = useAsync(
    () => (order?.businessId ? getBusiness(order.businessId) : Promise.resolve(null)),
    [order?.businessId]
  );
  const receipt = useAsync(
    () => (order?.id ? getReceiptByOrder(order.id) : Promise.resolve([])),
    [order?.id]
  );
  const invoices = useAsync(
    () => (order?.id ? getInvoiceByOrder(order.id) : Promise.resolve([])),
    [order?.id]
  );
  const proofs = useAsync(
    () => (order?.id ? getProofsByOrder(order.id) : Promise.resolve([])),
    [order?.id]
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState
          title="Order not found"
          message="This order does not exist or you do not have access to it."
        />
      </div>
    );
  }

  const items = order.items || [];
  const isBuyer = user && order.buyerId === user.uid;
  const isSeller =
    user && (order.ownerId === user.uid || business.data?.ownerId === user.uid);
  const paid = order.paymentStatus === PAYMENT_STATUS.CONFIRMED;
  const orderReceipt = receipt.data?.[0] || null;
  const orderInvoice = invoices.data?.[0] || null;
  const proofList = proofs.data || [];
  const pendingProof = proofList.find((proof) =>
    [PROOF_STATUS.SUBMITTED, PROOF_STATUS.UNDER_REVIEW].includes(proof.status)
  );

  const orderDoc = buildDocument(DOCUMENT_TYPES.ORDER_CONFIRMATION, order, {
    business: business.data,
  });

  const currentStepIndex = ORDER_STATUS_FLOW.indexOf(order.status);

  const refreshAll = () => {
    retry();
    receipt.retry();
    proofs.retry();
  };

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/orders" className="section__link">← Back to Orders</Link>
      </div>

      <div className="page__header">
        <h1 className="page__title">Order {order.orderNumber}</h1>
        <p className="page__subtitle">Placed {formatDate(order.createdAt)}</p>
        <div className="flex gap-8 flex-wrap">
          <StatusBadge status={order.status} />
          <StatusBadge status={order.paymentStatus} label={`Payment: ${order.paymentStatus}`} />
        </div>
      </div>

      {/* Payment confirmed banner with the automatically generated receipt. */}
      {paid && orderReceipt && (
        <div className="paid-banner">
          <div>
            <p className="paid-banner__title">✅ Payment confirmed</p>
            <p className="paid-banner__text">
              Your receipt {orderReceipt.receiptNumber} is ready.
            </p>
          </div>
          <div className="paid-banner__actions">
            <Link to={`/receipt/${orderReceipt.id}`} className="btn btn--outline">
              View Receipt
            </Link>
            <DownloadPdfButton
              document={buildDocument(DOCUMENT_TYPES.RECEIPT, orderReceipt, {
                business: business.data,
                order,
              })}
              label="Download Receipt PDF"
            />
          </div>
        </div>
      )}

      {isBuyer && pendingProof && (
        <div className="panel panel--muted">
          <p>
            ⏳ Your payment proof (reference <strong>{pendingProof.transactionReference}</strong>)
            is awaiting confirmation from the seller.
          </p>
        </div>
      )}

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
                        <td>{formatCurrency(it.price, order.currency)}</td>
                        <td>
                          {formatCurrency(
                            (Number(it.price) || 0) * (Number(it.quantity) || 0),
                            order.currency
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Buyer payment flow */}
          {isBuyer && !paid && (
            <div className="panel">
              <h2 className="panel__title">Pay for this order</h2>
              <p className="text-muted mb-16">
                Amount due: <strong>{formatCurrency(order.total, order.currency)}</strong>
              </p>
              <Button variant="primary" onClick={() => setPayOpen((open) => !open)}>
                {payOpen ? 'Close' : 'View payment details & submit proof'}
              </Button>
            </div>
          )}

          {isBuyer && !paid && payOpen && (
            <>
              <PaymentInstructions
                businessId={order.businessId}
                buyerId={user.uid}
                order={order}
                amount={order.total}
                currency={order.currency}
              />
              <PaymentProofForm
                order={order}
                defaultAmount={order.total}
                onSubmitted={() => {
                  setPayOpen(false);
                  refreshAll();
                }}
              />
            </>
          )}

          {/* Seller review of submitted proofs */}
          {isSeller && proofList.length > 0 && (
            <PaymentProofList
              proofs={proofList}
              order={order}
              business={business.data}
              onReviewed={refreshAll}
            />
          )}

          <div className="panel">
            <h2 className="panel__title">Order Timeline</h2>
            <div className="timeline">
              {ORDER_STATUS_FLOW.map((step, index) => {
                const done = currentStepIndex >= 0 && index <= currentStepIndex;
                const current = order.status === step;
                return (
                  <div
                    key={step}
                    className={`timeline__item ${done ? 'done' : ''} ${current ? 'current' : ''}`}
                  >
                    <span className="timeline__dot" />
                    <div className="timeline__label">{step}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h3 className="panel__title">Summary</h3>
            <dl className="kv">
              <dt>Subtotal</dt><dd>{formatCurrency(order.subtotal, order.currency)}</dd>
              <dt>Delivery</dt><dd>{formatCurrency(order.deliveryFee, order.currency)}</dd>
              <dt>Total</dt><dd>{formatCurrency(order.total, order.currency)}</dd>
              <dt>Payment</dt><dd><StatusBadge status={order.paymentStatus} /></dd>
            </dl>
            <div className="stack mt-16">
              <Link to={`/order/${order.id}/tracking`} className="btn btn--primary btn--block">
                Track Order
              </Link>
              <DownloadPdfButton
                document={orderDoc}
                label="Order Confirmation PDF"
                variant="outline"
                block
              />
            </div>
          </div>

          <div className="panel">
            <h3 className="panel__title">Documents</h3>
            <div className="stack">
              {orderInvoice ? (
                <Link to={`/invoice/${orderInvoice.id}`} className="btn btn--secondary btn--block">
                  Invoice {orderInvoice.invoiceNumber}
                </Link>
              ) : (
                <p className="text-muted">No invoice raised for this order.</p>
              )}
              {orderReceipt && (
                <Link to={`/receipt/${orderReceipt.id}`} className="btn btn--secondary btn--block">
                  Receipt {orderReceipt.receiptNumber}
                </Link>
              )}
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
