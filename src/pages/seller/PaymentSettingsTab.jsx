import { useState } from 'react';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import Badge from '../../components/Badge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../contexts/ToastContext';
import {
  getSellerPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  setPaymentMethodActive,
} from '../../services/sellerPaymentService';
import {
  SELLER_PAYMENT_METHOD_TYPES,
  sellerPaymentMethodType,
} from '../../utils/constants';

// ---------------------------------------------------------------------------
// Seller Dashboard → Settings → Payment Details
//
// Sellers configure how they want to be paid. These details are shown to a
// buyer only during an active transaction (see sellerPaymentService), never on
// the public business profile.
// ---------------------------------------------------------------------------
function emptyForm() {
  return { type: 'bank_transfer', label: '', details: {}, instructions: '', isActive: true };
}

export default function PaymentSettingsTab({ user, business }) {
  const { showToast } = useToast();
  const methods = useAsync(
    () => (business?.id ? getSellerPaymentMethods(business.id) : Promise.resolve([])),
    [business?.id]
  );

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!business) return null;

  const list = methods.data || [];
  const typeSpec = sellerPaymentMethodType(form.type);

  const reset = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (method) => {
    setForm({
      type: method.type,
      label: method.label || '',
      details: method.details || {},
      instructions: method.instructions || '',
      isActive: method.isActive !== false,
    });
    setEditingId(method.id);
    setShowForm(true);
  };

  const setDetail = (fieldId) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, details: { ...prev.details, [fieldId]: value } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const required = (typeSpec?.fields || []).filter((field) => field.required);
    const missing = required.find((field) => !String(form.details[field.id] || '').trim());
    if (missing) {
      showToast(`${missing.label} is required.`, 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updatePaymentMethod(editingId, {
          type: form.type,
          label: form.label.trim(),
          details: form.details,
          instructions: form.instructions.trim(),
          isActive: form.isActive,
        });
        showToast('Payment method updated.', 'success');
      } else {
        await createPaymentMethod(business.id, user.uid, {
          type: form.type,
          label: form.label.trim() || typeSpec?.label,
          details: form.details,
          instructions: form.instructions.trim(),
          isActive: form.isActive,
        });
        showToast('Payment method added.', 'success');
      }
      reset();
      methods.retry();
    } catch (err) {
      showToast(err.message || 'Could not save the payment method.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (method) => {
    try {
      await setPaymentMethodActive(method.id, method.isActive === false);
      methods.retry();
    } catch (err) {
      showToast(err.message || 'Could not update the payment method.', 'error');
    }
  };

  const remove = async (method) => {
    try {
      await deletePaymentMethod(method.id);
      showToast('Payment method removed.', 'success');
      methods.retry();
    } catch (err) {
      showToast(err.message || 'Could not remove the payment method.', 'error');
    }
  };

  return (
    <>
      <div className="panel dash-toolbar mt-16">
        <div>
          <h2 className="panel__title">Payment Details</h2>
          <p className="text-muted">
            Configure how buyers pay you. These details are shown only to a buyer with an
            active order or invoice with your business — never on your public profile.
          </p>
        </div>
        <Button
          variant={showForm ? 'ghost' : 'primary'}
          onClick={() => (showForm ? reset() : setShowForm(true))}
        >
          {showForm ? 'Cancel' : '+ Add payment method'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">{editingId ? 'Edit payment method' : 'New payment method'}</h3>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="pm-type">Method type *</label>
              <select
                id="pm-type"
                className="form__select"
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value, details: {} }))
                }
              >
                {SELLER_PAYMENT_METHOD_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="pm-label">Display label</label>
              <input
                id="pm-label"
                className="form__input"
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder={typeSpec?.label}
              />
            </div>
          </div>

          {(typeSpec?.fields || []).map((field) => (
            <div className="form__group" key={field.id}>
              <label className="form__label" htmlFor={`pm-${field.id}`}>
                {field.label}{field.required ? ' *' : ''}
              </label>
              <input
                id={`pm-${field.id}`}
                className="form__input"
                value={form.details[field.id] || ''}
                onChange={setDetail(field.id)}
                required={field.required}
              />
            </div>
          ))}

          <div className="form__group">
            <label className="form__label" htmlFor="pm-instructions">Instructions for the buyer</label>
            <textarea
              id="pm-instructions"
              className="form__textarea"
              value={form.instructions}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, instructions: event.target.value }))
              }
              placeholder="e.g. Use your order number as the payment reference."
            />
          </div>

          <label className="form__check">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
            />
            <span>Accept payments through this method</span>
          </label>

          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? 'Save changes' : 'Add payment method'}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-16">
        {methods.loading && <Spinner size="large" label="Loading payment methods…" />}
        {methods.error && <ErrorState message={methods.error} onRetry={methods.retry} />}

        {!methods.loading && !methods.error && list.length === 0 && (
          <div className="panel">
            <EmptyState
              title="No payment methods yet"
              message="Add at least one so buyers know how to pay you at checkout."
              action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Add payment method</Button>}
            />
          </div>
        )}

        {!methods.loading && list.length > 0 && (
          <div className="pay-methods">
            {list.map((method) => {
              const spec = sellerPaymentMethodType(method.type);
              const details = method.details || {};
              return (
                <div key={method.id} className="pay-method">
                  <div className="pay-method__head">
                    <span className="pay-method__icon" aria-hidden="true">{spec?.icon || '💳'}</span>
                    <span className="pay-method__name">{method.label || spec?.label}</span>
                    <Badge tone={method.isActive === false ? 'neutral' : 'success'}>
                      {method.isActive === false ? 'Inactive' : 'Active'}
                    </Badge>
                  </div>

                  <dl className="pay-method__details">
                    {(spec?.fields || [])
                      .filter((field) => details[field.id])
                      .map((field) => (
                        <div key={field.id} className="pay-method__row">
                          <dt>{field.label}</dt>
                          <dd>{details[field.id]}</dd>
                        </div>
                      ))}
                  </dl>

                  {method.instructions && <p className="pay-method__note">{method.instructions}</p>}

                  <div className="dash-actions">
                    <Button variant="outline" size="sm" onClick={() => startEdit(method)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggle(method)}>
                      {method.isActive === false ? 'Activate' : 'Deactivate'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(method)}>Remove</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
