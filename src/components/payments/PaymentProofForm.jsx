import { useState } from 'react';
import Button from '../Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { uploadImageToCloudinary } from '../../cloudinary/upload';
import { submitPaymentProof } from '../../services/paymentProofService';
import { PAYMENT_METHODS } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Proof of payment submission.
//
// This records a *claim*, not a payment. The order is not marked paid here —
// the seller (or an admin) must review and confirm the evidence first.
// ---------------------------------------------------------------------------
export default function PaymentProofForm({
  order = null,
  invoice = null,
  defaultAmount = 0,
  onSubmitted,
}) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    amount: defaultAmount ? String(defaultAmount) : '',
    method: '',
    transactionReference: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setError('');
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') {
      showToast('Upload an image or PDF of your payment confirmation.', 'error');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImageToCloudinary(file);
      setProofUrl(result.secureUrl);
      showToast('Proof uploaded.', 'success');
    } catch (err) {
      showToast(err.message || 'Upload failed. You can still submit without a file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Enter the amount you paid.');
      return;
    }
    if (!form.method) {
      setError('Select the payment method you used.');
      return;
    }
    if (!form.transactionReference.trim()) {
      setError('Enter the transaction reference from your payment confirmation.');
      return;
    }

    setSubmitting(true);
    try {
      await submitPaymentProof({
        order,
        invoice,
        buyerId: user.uid,
        buyerName: profile?.name || user.email,
        amount,
        method: form.method,
        transactionReference: form.transactionReference.trim(),
        paymentDate: form.paymentDate,
        proofUrl,
        note: form.note,
      });
      showToast('Payment proof submitted. The seller will review it shortly.', 'success');
      onSubmitted?.();
    } catch (err) {
      setError(err.message || 'Could not submit your payment proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2 className="panel__title">Submit Payment Proof</h2>
      <p className="text-muted mb-16">
        Already paid? Send the details below so the seller can verify your payment and issue
        your receipt.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="form__row">
          <div className="form__group">
            <label className="form__label" htmlFor="proof-amount">Amount paid *</label>
            <input
              id="proof-amount"
              className="form__input"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={setField('amount')}
              required
            />
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="proof-method">Payment method *</label>
            <select
              id="proof-method"
              className="form__select"
              value={form.method}
              onChange={setField('method')}
              required
            >
              <option value="">Select method</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method.id} value={method.id}>{method.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form__row">
          <div className="form__group">
            <label className="form__label" htmlFor="proof-ref">Transaction reference *</label>
            <input
              id="proof-ref"
              className="form__input"
              value={form.transactionReference}
              onChange={setField('transactionReference')}
              placeholder="e.g. MP240903.1423.A12345"
              required
            />
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="proof-date">Payment date *</label>
            <input
              id="proof-date"
              className="form__input"
              type="date"
              value={form.paymentDate}
              onChange={setField('paymentDate')}
              required
            />
          </div>
        </div>

        <div className="form__group">
          <label className="form__label" htmlFor="proof-file">Upload proof (screenshot or PDF)</label>
          <input
            id="proof-file"
            className="form__input"
            type="file"
            accept="image/*,application/pdf"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading && <p className="form__hint">Uploading…</p>}
          {proofUrl && <p className="form__hint form__hint--ok">✓ Proof attached</p>}
        </div>

        <div className="form__group">
          <label className="form__label" htmlFor="proof-note">Additional note</label>
          <textarea
            id="proof-note"
            className="form__textarea"
            value={form.note}
            onChange={setField('note')}
            placeholder="Anything the seller should know about this payment"
          />
        </div>

        {error && <div className="form__msg form__msg--error">{error}</div>}

        <p className="form__hint">
          Your order is marked paid only after the seller verifies this payment. Submitting false
          proof is recorded and may lead to account suspension.
        </p>

        <div className="mt-16">
          <Button type="submit" variant="primary" loading={submitting} disabled={uploading}>
            Submit Payment Proof
          </Button>
        </div>
      </form>
    </div>
  );
}
