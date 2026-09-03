import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DocumentPage from '../components/documents/DocumentPage';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import PaymentInstructions from '../components/payments/PaymentInstructions';
import PaymentProofForm from '../components/payments/PaymentProofForm';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import { getInvoice, markInvoiceViewed } from '../services/invoiceService';
import { getBusiness } from '../services/businessService';
import { getOrder } from '../services/orderService';
import { buildDocument } from '../documents/model';
import {
  DOCUMENT_TYPES,
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS,
} from '../utils/constants';
import { normalizeInvoiceStatus } from '../documents/model';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/format';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: invoice, loading, error, notFound, retry } = useDocument(getInvoice, id, []);
  const [payOpen, setPayOpen] = useState(false);

  const business = useAsync(
    () => (invoice?.businessId ? getBusiness(invoice.businessId) : Promise.resolve(null)),
    [invoice?.businessId]
  );
  const order = useAsync(
    () => (invoice?.orderId ? getOrder(invoice.orderId) : Promise.resolve(null)),
    [invoice?.orderId]
  );

  // Buyer opening a sent invoice moves it to VIEWED, which the seller sees in
  // their invoice list. Fire-and-forget so it never blocks rendering.
  useEffect(() => {
    if (invoice && user && invoice.customerId === user.uid) {
      markInvoiceViewed(invoice, user.uid).catch(() => {});
    }
  }, [invoice, user]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Invoice not found" message="This invoice does not exist." />
      </div>
    );
  }

  const doc = buildDocument(DOCUMENT_TYPES.INVOICE, invoice, {
    business: business.data,
    order: order.data,
    buyer: invoice.customerId === user?.uid ? { email: user?.email } : null,
  });

  const status = normalizeInvoiceStatus(invoice.status);
  const isBuyer = user && invoice.customerId === user.uid;
  const balance = Number(invoice.balance ?? invoice.total) || 0;
  const payable =
    isBuyer && balance > 0 && ![INVOICE_STATUS.CANCELLED, INVOICE_STATUS.PAID].includes(status);

  const actions = payable ? (
    <Button variant="primary" onClick={() => setPayOpen((open) => !open)}>
      {payOpen ? 'Close payment' : `Pay ${formatCurrency(balance, invoice.currency)}`}
    </Button>
  ) : null;

  return (
    <DocumentPage
      document={doc}
      backTo="/invoices"
      backLabel="Back to Invoices"
      actions={actions}
    >
      <div className="panel">
        <h2 className="panel__title">Invoice status</h2>
        <div className="invoice-flow">
          {[
            INVOICE_STATUS.DRAFT,
            INVOICE_STATUS.SENT,
            INVOICE_STATUS.VIEWED,
            INVOICE_STATUS.PARTIALLY_PAID,
            INVOICE_STATUS.PAID,
          ].map((step) => (
            <span
              key={step}
              className={`invoice-flow__step ${status === step ? 'is-current' : ''}`}
            >
              {INVOICE_STATUS_LABELS[step]}
            </span>
          ))}
        </div>
        {[INVOICE_STATUS.OVERDUE, INVOICE_STATUS.CANCELLED].includes(status) && (
          <p className="mt-16">
            <StatusBadge status={status} label={INVOICE_STATUS_LABELS[status]} />
          </p>
        )}
      </div>

      {payable && payOpen && (
        <>
          <PaymentInstructions
            businessId={invoice.businessId}
            buyerId={user.uid}
            invoice={invoice}
            amount={balance}
            currency={invoice.currency}
          />
          <PaymentProofForm
            invoice={invoice}
            order={order.data}
            defaultAmount={balance}
            onSubmitted={() => {
              setPayOpen(false);
              retry();
            }}
          />
        </>
      )}

      <div className="panel">
        <h2 className="panel__title">Related records</h2>
        <div className="flex gap-8 flex-wrap">
          {invoice.orderId && (
            <Link to={`/order/${invoice.orderId}`} className="btn btn--outline btn--sm">
              View order {invoice.orderNumber || ''}
            </Link>
          )}
          {invoice.quotationId && (
            <Link to={`/quotation/${invoice.quotationId}`} className="btn btn--outline btn--sm">
              View quotation
            </Link>
          )}
          {invoice.verificationCode && (
            <Link to={`/verify/${invoice.verificationCode}`} className="btn btn--ghost btn--sm">
              Verify this invoice
            </Link>
          )}
        </div>
      </div>
    </DocumentPage>
  );
}
