import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DocumentPage from '../components/documents/DocumentPage';
import Button from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import {
  getQuotation,
  markQuotationViewed,
  decideQuotation,
  respondToQuotationRequest,
} from '../services/quotationService';
import { getBusiness } from '../services/businessService';
import { buildDocument } from '../documents/model';
import {
  DOCUMENT_TYPES,
  QUOTATION_STATUS,
  QUOTATION_STATUS_LABELS,
} from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatDate } from '../utils/format';

// Statuses where the quotation is still just a request — there is no priced
// document to render yet, so the buyer's brief is shown instead.
const REQUEST_ONLY = [
  QUOTATION_STATUS.REQUESTED,
  QUOTATION_STATUS.CLARIFICATION,
  QUOTATION_STATUS.DECLINED,
];

export default function QuotationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: quotation, loading, error, notFound, retry } = useDocument(getQuotation, id, []);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const business = useAsync(
    () => (quotation?.businessId ? getBusiness(quotation.businessId) : Promise.resolve(null)),
    [quotation?.businessId]
  );

  useEffect(() => {
    if (quotation && user && quotation.customerId === user.uid) {
      markQuotationViewed(quotation, user.uid).catch(() => {});
    }
  }, [quotation, user]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Quotation not found" message="This quotation does not exist." />
      </div>
    );
  }

  const isBuyer = user && quotation.customerId === user.uid;
  const isSeller = user && (quotation.ownerId === user.uid || business.data?.ownerId === user.uid);
  const status = quotation.status || QUOTATION_STATUS.DRAFT;
  const request = quotation.request || {};
  const showRequestOnly = REQUEST_ONLY.includes(status) && !(quotation.items || []).length;

  const handleDecision = async (accepted) => {
    setBusy(accepted ? 'accept' : 'reject');
    try {
      await decideQuotation(quotation, accepted, { note });
      showToast(accepted ? 'Quotation accepted.' : 'Quotation declined.', 'success');
      setNote('');
      retry();
    } catch (err) {
      showToast(err.message || 'Could not record your response.', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleSellerResponse = async (action) => {
    setBusy(action);
    try {
      await respondToQuotationRequest(quotation, action, { note });
      showToast('Response sent to the buyer.', 'success');
      setNote('');
      retry();
    } catch (err) {
      showToast(err.message || 'Could not send your response.', 'error');
    } finally {
      setBusy('');
    }
  };

  // ---- Request-only view (no priced quotation yet) ----
  if (showRequestOnly) {
    return (
      <div className="container page">
        <div className="mt-8 mb-16">
          <Link to="/quotations" className="section__link">← Back to Quotations</Link>
        </div>

        <div className="page__header">
          <h1 className="page__title">Quotation request {quotation.quotationNumber}</h1>
          <p className="page__subtitle">Requested {formatDate(quotation.createdAt)}</p>
          <StatusBadge status={status} label={QUOTATION_STATUS_LABELS[status] || status} />
        </div>

        <div className="panel">
          <h2 className="panel__title">Request details</h2>
          <dl className="kv">
            <dt>Product / service</dt><dd>{request.productService || '—'}</dd>
            <dt>Quantity</dt><dd>{request.quantity || '—'}</dd>
            {request.requirements && (<><dt>Requirements</dt><dd>{request.requirements}</dd></>)}
            {request.preferredDelivery && (<><dt>Preferred delivery</dt><dd>{request.preferredDelivery}</dd></>)}
            {request.message && (<><dt>Message</dt><dd>{request.message}</dd></>)}
            <dt>Buyer</dt><dd>{quotation.customerName || '—'}</dd>
            <dt>Seller</dt><dd>{quotation.businessName || '—'}</dd>
          </dl>
        </div>

        {quotation.sellerResponse && (
          <div className="panel">
            <h2 className="panel__title">Seller response</h2>
            <p>{quotation.sellerResponse}</p>
          </div>
        )}

        {isSeller && status === QUOTATION_STATUS.REQUESTED && (
          <div className="panel">
            <h2 className="panel__title">Respond to this request</h2>
            <div className="form__group">
              <label className="form__label" htmlFor="q-note">Message to the buyer (optional)</label>
              <textarea
                id="q-note"
                className="form__textarea"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ask a question, or explain your decision"
              />
            </div>
            <div className="flex gap-8 flex-wrap mt-16">
              <Button variant="primary" loading={busy === 'accept'} onClick={() => handleSellerResponse('accept')}>
                Accept &amp; prepare quotation
              </Button>
              <Button variant="outline" loading={busy === 'clarify'} onClick={() => handleSellerResponse('clarify')}>
                Request clarification
              </Button>
              <Button variant="ghost" loading={busy === 'decline'} onClick={() => handleSellerResponse('decline')}>
                Decline
              </Button>
            </div>
            <p className="form__hint mt-16">
              After accepting, build and send the priced quotation from
              {' '}<Link to="/seller?tab=quotations" className="table__link">Seller Dashboard → Quotations</Link>.
            </p>
          </div>
        )}

        {isBuyer && status === QUOTATION_STATUS.CLARIFICATION && (
          <div className="panel panel--muted">
            <p>
              The seller has asked for more information. Reply through
              {' '}<Link to="/messages" className="table__link">Messages</Link> to keep this moving.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---- Full branded quotation document ----
  const doc = buildDocument(DOCUMENT_TYPES.QUOTATION, quotation, {
    business: business.data,
    buyer: isBuyer ? { email: user?.email } : null,
  });

  const canDecide =
    isBuyer && [QUOTATION_STATUS.SENT, QUOTATION_STATUS.VIEWED].includes(status);

  return (
    <DocumentPage document={doc} backTo="/quotations" backLabel="Back to Quotations">
      {request.productService && (
        <div className="panel">
          <h2 className="panel__title">Original request</h2>
          <dl className="kv">
            <dt>Product / service</dt><dd>{request.productService}</dd>
            <dt>Quantity</dt><dd>{request.quantity || '—'}</dd>
            {request.requirements && (<><dt>Requirements</dt><dd>{request.requirements}</dd></>)}
            {request.preferredDelivery && (<><dt>Preferred delivery</dt><dd>{request.preferredDelivery}</dd></>)}
          </dl>
        </div>
      )}

      {canDecide && (
        <div className="panel">
          <h2 className="panel__title">Respond to this quotation</h2>
          <div className="form__group">
            <label className="form__label" htmlFor="q-decision-note">Note to the seller (optional)</label>
            <textarea
              id="q-decision-note"
              className="form__textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="flex gap-8 flex-wrap mt-16">
            <Button variant="primary" loading={busy === 'accept'} onClick={() => handleDecision(true)}>
              Accept quotation
            </Button>
            <Button variant="outline" loading={busy === 'reject'} onClick={() => handleDecision(false)}>
              Decline
            </Button>
          </div>
        </div>
      )}

      {status === QUOTATION_STATUS.ACCEPTED && (
        <div className="panel panel--muted">
          <p>
            ✅ This quotation was accepted{quotation.decidedAt ? ` on ${formatDate(quotation.decidedAt)}` : ''}.
            {isSeller && ' You can now raise an invoice from your Seller Dashboard.'}
          </p>
        </div>
      )}

      {quotation.verificationCode && (
        <div className="panel">
          <h2 className="panel__title">Verification</h2>
          <Link to={`/verify/${quotation.verificationCode}`} className="btn btn--ghost btn--sm">
            Verify this quotation
          </Link>
        </div>
      )}
    </DocumentPage>
  );
}
