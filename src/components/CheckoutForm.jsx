import { useState } from 'react';
import Button from './Button';
import { PAYMENT_METHODS } from '../utils/constants';
import { formatCurrency } from '../utils/format';

// Lightweight checkout / request form used by the product and service detail
// buy boxes. It only collects the delivery/contact details; the caller is
// responsible for creating the order and navigating to the result.
export default function CheckoutForm({
  buyer,
  summary = '',
  total = 0,
  deliveryFee = 0,
  submitting = false,
  submitLabel = 'Place Order',
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    name: buyer?.name || '',
    phone: buyer?.phone || '',
    address: buyer?.location || '',
    paymentMethod: '',
    note: '',
  });
  const [error, setError] = useState('');

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.paymentMethod) {
      setError('Choose a payment method to continue.');
      return;
    }
    onSubmit({ ...form });
  };

  const delivery = Number(deliveryFee) || 0;
  const amount = Number(total) || 0;

  return (
    <form className="form mt-16" onSubmit={handleSubmit}>
      <div className="form__group">
        <label className="form__label" htmlFor="checkout-name">Full name</label>
        <input
          id="checkout-name"
          className="form__input"
          value={form.name}
          onChange={setField('name')}
          required
          placeholder="Your full name"
        />
      </div>

      <div className="form__row">
        <div className="form__group">
          <label className="form__label" htmlFor="checkout-phone">Phone</label>
          <input
            id="checkout-phone"
            className="form__input"
            type="tel"
            value={form.phone}
            onChange={setField('phone')}
            required
            placeholder="+256…"
          />
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="checkout-method">Payment method</label>
          <select
            id="checkout-method"
            className="form__select"
            value={form.paymentMethod}
            onChange={setField('paymentMethod')}
            required
          >
            <option value="">Select payment method</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.id} value={method.id}>{method.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form__group">
        <label className="form__label" htmlFor="checkout-address">Delivery address / service location</label>
        <textarea
          id="checkout-address"
          className="form__textarea"
          value={form.address}
          onChange={setField('address')}
          required
          placeholder="City, town, street or directions"
        />
      </div>

      <div className="form__group">
        <label className="form__label" htmlFor="checkout-note">Order note (optional)</label>
        <textarea
          id="checkout-note"
          className="form__textarea"
          value={form.note}
          onChange={setField('note')}
          placeholder="Anything the seller should know"
        />
      </div>

      {summary && <p className="form__msg form__msg--info">{summary}</p>}
      <div className="form__msg form__msg--info">
        Items&nbsp;{formatCurrency(amount)} · Delivery&nbsp;{formatCurrency(delivery)} · Total&nbsp;{formatCurrency(amount + delivery)}
      </div>
      {error && <div className="form__msg form__msg--error">{error}</div>}

      <div className="flex items-center gap-8 mt-16">
        <Button type="submit" variant="primary" loading={submitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
