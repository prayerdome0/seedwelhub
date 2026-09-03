import { Link, useParams } from 'react-router-dom';
import DocumentPage from '../components/documents/DocumentPage';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import { getReceipt } from '../services/receiptService';
import { getBusiness } from '../services/businessService';
import { buildDocument } from '../documents/model';
import { DOCUMENT_TYPES } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';

export default function ReceiptDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: receipt, loading, error, notFound, retry } = useDocument(getReceipt, id, []);

  const business = useAsync(
    () => (receipt?.businessId ? getBusiness(receipt.businessId) : Promise.resolve(null)),
    [receipt?.businessId]
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Receipt not found" message="This receipt does not exist." />
      </div>
    );
  }

  const doc = buildDocument(DOCUMENT_TYPES.RECEIPT, receipt, {
    business: business.data,
    buyer: receipt.customerId === user?.uid ? { email: user?.email } : null,
  });

  return (
    <DocumentPage document={doc} backTo="/receipts" backLabel="Back to Receipts">
      <div className="panel">
        <h2 className="panel__title">Related records</h2>
        <div className="flex gap-8 flex-wrap">
          {receipt.orderId && (
            <Link to={`/order/${receipt.orderId}`} className="btn btn--outline btn--sm">
              View order {receipt.orderNumber || ''}
            </Link>
          )}
          {receipt.invoiceId && (
            <Link to={`/invoice/${receipt.invoiceId}`} className="btn btn--outline btn--sm">
              View invoice {receipt.invoiceNumber || ''}
            </Link>
          )}
          {receipt.paymentId && (
            <Link to={`/payment/${receipt.paymentId}`} className="btn btn--outline btn--sm">
              View payment record
            </Link>
          )}
          {receipt.verificationCode && (
            <Link to={`/verify/${receipt.verificationCode}`} className="btn btn--ghost btn--sm">
              Verify this receipt
            </Link>
          )}
        </div>
      </div>
    </DocumentPage>
  );
}
