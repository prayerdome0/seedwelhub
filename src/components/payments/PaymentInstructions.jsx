import Spinner from '../Spinner';
import useAsync from '../../hooks/useAsync';
import { getPaymentInstructionsForBuyer } from '../../services/sellerPaymentService';
import { sellerPaymentMethodType } from '../../utils/constants';
import { formatCurrency } from '../../utils/format';

// ---------------------------------------------------------------------------
// Shows the seller's payment details to a buyer at checkout / payment time.
//
// Security: these details are never rendered from public profile data. They
// are fetched through getPaymentInstructionsForBuyer, which only returns them
// when this buyer genuinely has an active order or invoice with the seller.
// ---------------------------------------------------------------------------
export default function PaymentInstructions({
  businessId,
  buyerId,
  order = null,
  invoice = null,
  amount,
  currency,
}) {
  const { data, loading } = useAsync(
    () =>
      businessId && buyerId
        ? getPaymentInstructionsForBuyer({ businessId, buyerId, order, invoice })
        : Promise.resolve([]),
    [businessId, buyerId, order?.id, invoice?.id]
  );

  if (loading) {
    return (
      <div className="panel">
        <Spinner size="sm" label="Loading payment instructions…" />
      </div>
    );
  }

  const methods = data || [];

  if (methods.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel__title">Payment Instructions</h2>
        <p className="text-muted">
          This seller has not published payment details yet. Message them to arrange payment,
          then submit your proof of payment below.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel__title">Payment Instructions</h2>
      {amount != null && (
        <p className="pay-amount">
          Amount due: <strong>{formatCurrency(amount, currency)}</strong>
        </p>
      )}

      <div className="pay-methods">
        {methods.map((method) => {
          const type = sellerPaymentMethodType(method.type);
          const details = method.details || {};
          const fields = (type?.fields || []).filter((field) => details[field.id]);

          return (
            <div key={method.id} className="pay-method">
              <div className="pay-method__head">
                <span className="pay-method__icon" aria-hidden="true">{type?.icon || '💳'}</span>
                <span className="pay-method__name">{method.label || type?.label || 'Payment method'}</span>
              </div>

              <dl className="pay-method__details">
                {fields.map((field) => (
                  <div key={field.id} className="pay-method__row">
                    <dt>{field.label}</dt>
                    <dd>{details[field.id]}</dd>
                  </div>
                ))}
              </dl>

              {method.instructions && (
                <p className="pay-method__note">{method.instructions}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="pay-warning">
        ⚠️ Only pay using the details shown here. If anyone asks you to pay a different account,
        stop and report it — Xacheus will never change these details by message.
      </p>
    </div>
  );
}
