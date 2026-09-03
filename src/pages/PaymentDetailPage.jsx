import { Link, useParams } from 'react-router-dom';
import Image from '../components/Image';
import DocumentPage from '../components/documents/DocumentPage';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import { getPayment } from '../services/paymentService';
import { getOrder } from '../services/orderService';
import { getBusiness } from '../services/businessService';
import { getReceiptByOrder } from '../services/receiptService';
import { buildDocument } from '../documents/model';
import { DOCUMENT_TYPES, PAYMENT_STATUS } from '../utils/constants';
import { formatDateTime } from '../utils/format';

// Payment confirmation document. Renders through the same document identity as
// receipts, invoices and quotations so every Seedwel Hub record looks alike and
// can be downloaded as a PDF.
export default function PaymentDetailPage() {
  const { id } = useParams();
  const { data: payment, loading, error, notFound, retry } = useDocument(getPayment, id, []);

  const order = useAsync(
    () => (payment?.orderId ? getOrder(payment.orderId) : Promise.resolve(null)),
    [payment?.orderId]
  );
  const business = useAsync(
    () => (payment?.businessId ? getBusiness(payment.businessId) : Promise.resolve(null)),
    [payment?.businessId]
  );
  // getReceiptByOrder resolves to an array (a limit-1 query), not a document.
  const receipts = useAsync(
    () => (payment?.orderId ? getReceiptByOrder(payment.orderId) : Promise.resolve([])),
    [payment?.orderId]
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

  const confirmed = payment.status === PAYMENT_STATUS.CONFIRMED;
  const receipt = receipts.data?.[0] || null;

  const doc = buildDocument(
    DOCUMENT_TYPES.PAYMENT_CONFIRMATION,
    {
      ...payment,
      orderNumber: payment.orderNumber || order.data?.orderNumber,
      customerName: payment.buyerName || order.data?.buyerName,
      customerEmail: payment.buyerEmail || order.data?.buyerEmail,
      customerPhone: payment.buyerPhone || order.data?.buyerPhone,
      items: order.data?.items || [],
    },
    { business: business.data }
  );

  return (
    <DocumentPage document={doc} backTo="/payments" backLabel="Back to Payments">
      {confirmed && receipt && (
        <div className="panel panel--success">
          <h2 className="panel__title">✅ Payment confirmed</h2>
          <p className="text-muted mb-16">
            This payment has been verified by the seller and your receipt is ready.
          </p>
          <Link to={`/receipt/${receipt.id}`} className="btn btn--primary">
            View receipt {receipt.receiptNumber || ''}
          </Link>
        </div>
      )}

      {payment.proofUrl && (
        <div className="panel">
          <h2 className="panel__title">Payment proof</h2>
          <p className="text-muted mb-16">
            Submitted {formatDateTime(payment.submittedAt || payment.createdAt)}.
          </p>
          <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="proof-thumb">
            <Image src={payment.proofUrl} alt="Payment proof" className="w-full" />
          </a>
        </div>
      )}

      <div className="panel">
        <h2 className="panel__title">Related records</h2>
        <div className="flex gap-8 flex-wrap">
          {order.data && (
            <Link to={`/order/${order.data.id}`} className="btn btn--outline btn--sm">
              View order {order.data.orderNumber}
            </Link>
          )}
          {receipt && (
            <Link to={`/receipt/${receipt.id}`} className="btn btn--outline btn--sm">
              View receipt
            </Link>
          )}
          {payment.invoiceId && (
            <Link to={`/invoice/${payment.invoiceId}`} className="btn btn--outline btn--sm">
              View invoice
            </Link>
          )}
          {!order.data && !receipt && !payment.invoiceId && (
            <p className="text-muted">No linked documents.</p>
          )}
        </div>
      </div>

      {payment.note && (
        <div className="panel">
          <h2 className="panel__title">Note</h2>
          <p className="text-muted">{payment.note}</p>
        </div>
      )}
    </DocumentPage>
  );
}
