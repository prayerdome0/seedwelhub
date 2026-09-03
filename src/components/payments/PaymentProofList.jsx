import { useState } from 'react';
import Image from '../Image';
import Button from '../Button';
import Badge from '../Badge';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  confirmPaymentProof,
  rejectPaymentProof,
} from '../../services/paymentProofService';
import { findDuplicateReferences } from '../../services/paymentService';
import { PROOF_STATUS, PROOF_STATUS_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/format';

// ---------------------------------------------------------------------------
// Seller-side review of submitted payment proofs.
//
// The seller sees everything needed to make a judgement — amount, method,
// transaction reference, evidence, buyer and timestamps — plus an automatic
// duplicate-reference check, because the same reference appearing on more than
// one order is the classic recycled-screenshot scam.
//
// Confirming here is what marks the order paid and generates the receipt.
// ---------------------------------------------------------------------------
function statusTone(status) {
  if (status === PROOF_STATUS.CONFIRMED) return 'success';
  if (status === PROOF_STATUS.REJECTED) return 'danger';
  if (status === PROOF_STATUS.UNDER_REVIEW) return 'warning';
  return 'info';
}

export default function PaymentProofList({ proofs, order, business, onReviewed }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState('');
  const [reason, setReason] = useState({});
  const [duplicates, setDuplicates] = useState({});

  const runDuplicateCheck = async (proof) => {
    setBusyId(`check-${proof.id}`);
    try {
      const matches = await findDuplicateReferences(proof.transactionReference, proof.orderId);
      setDuplicates((prev) => ({ ...prev, [proof.id]: matches }));
      showToast(
        matches.length
          ? `⚠️ This reference appears on ${matches.length} other payment(s).`
          : '✓ No duplicate use of this reference found.',
        matches.length ? 'error' : 'success'
      );
    } catch {
      showToast('Could not run the duplicate check.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleConfirm = async (proof) => {
    setBusyId(`confirm-${proof.id}`);
    try {
      const { receipt } = await confirmPaymentProof(proof, {
        reviewerId: user.uid,
        business,
      });
      showToast(
        receipt
          ? `Payment confirmed. Receipt ${receipt.receiptNumber} issued.`
          : 'Payment confirmed.',
        'success'
      );
      onReviewed?.();
    } catch (err) {
      showToast(err.message || 'Could not confirm the payment.', 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleReject = async (proof) => {
    setBusyId(`reject-${proof.id}`);
    try {
      await rejectPaymentProof(proof, {
        reviewerId: user.uid,
        reason: reason[proof.id] || '',
      });
      showToast('Payment proof rejected. The buyer has been notified.', 'success');
      onReviewed?.();
    } catch (err) {
      showToast(err.message || 'Could not reject the payment proof.', 'error');
    } finally {
      setBusyId('');
    }
  };

  if (!proofs?.length) return null;

  return (
    <div className="panel">
      <h2 className="panel__title">Payment Proofs ({proofs.length})</h2>

      <div className="proof-list">
        {proofs.map((proof) => {
          const pending = [PROOF_STATUS.SUBMITTED, PROOF_STATUS.UNDER_REVIEW].includes(proof.status);
          const dupes = duplicates[proof.id];

          return (
            <article key={proof.id} className="proof-card">
              <header className="proof-card__head">
                <div>
                  <span className="proof-card__amount">
                    {formatCurrency(proof.amount, proof.currency || order?.currency)}
                  </span>
                  <span className="proof-card__meta">
                    submitted {formatDateTime(proof.submittedAt || proof.createdAt)}
                  </span>
                </div>
                <Badge tone={statusTone(proof.status)}>
                  {PROOF_STATUS_LABELS[proof.status] || proof.status}
                </Badge>
              </header>

              <dl className="kv proof-card__details">
                <dt>Buyer</dt><dd>{proof.buyerName || '—'}</dd>
                <dt>Method</dt><dd>{proof.method || '—'}</dd>
                <dt>Reference</dt><dd><code>{proof.transactionReference || '—'}</code></dd>
                <dt>Payment date</dt><dd>{formatDate(proof.paymentDate)}</dd>
                {proof.orderNumber && (<><dt>Order</dt><dd>{proof.orderNumber}</dd></>)}
                {proof.note && (<><dt>Buyer note</dt><dd>{proof.note}</dd></>)}
                {proof.reviewNote && (<><dt>Review note</dt><dd>{proof.reviewNote}</dd></>)}
              </dl>

              {proof.proofUrl && (
                <div className="proof-card__evidence">
                  <a href={proof.proofUrl} target="_blank" rel="noreferrer">
                    <Image src={proof.proofUrl} alt="Payment proof" />
                  </a>
                  <a
                    href={proof.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="section__link"
                  >
                    Open full evidence ↗
                  </a>
                </div>
              )}

              {dupes && dupes.length > 0 && (
                <div className="proof-card__alert">
                  ⚠️ This transaction reference has been used on {dupes.length} other payment
                  record(s). Verify with your bank or mobile money statement before confirming.
                </div>
              )}

              {pending && (
                <div className="proof-card__actions">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={busyId === `check-${proof.id}`}
                    onClick={() => runDuplicateCheck(proof)}
                  >
                    Check reference
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busyId === `confirm-${proof.id}`}
                    onClick={() => handleConfirm(proof)}
                  >
                    Payment Confirmed
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === `reject-${proof.id}`}
                    onClick={() => handleReject(proof)}
                  >
                    Payment Rejected
                  </Button>
                  <input
                    className="form__input proof-card__reason"
                    placeholder="Reason (for rejection)"
                    value={reason[proof.id] || ''}
                    onChange={(event) =>
                      setReason((prev) => ({ ...prev, [proof.id]: event.target.value }))
                    }
                  />
                </div>
              )}

              {pending && (
                <p className="proof-card__warning">
                  Only confirm after you have seen the money in your account. Confirming
                  generates the buyer's receipt and cannot be undone.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
