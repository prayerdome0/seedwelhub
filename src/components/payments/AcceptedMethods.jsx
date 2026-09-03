import useAsync from '../../hooks/useAsync';
import { getAcceptedMethodSummary } from '../../services/sellerPaymentService';
import { sellerPaymentMethodType } from '../../utils/constants';

// ---------------------------------------------------------------------------
// Checkout-time preview of how a seller accepts payment.
//
// At checkout no order exists yet, so there is no buyer/seller relationship to
// verify — which means account numbers must NOT be shown here. This component
// deliberately renders only the channel names (Bank Transfer, Mobile Money…).
// The actual account details appear on the order page after the order is
// placed, via <PaymentInstructions />, which verifies ownership first.
// ---------------------------------------------------------------------------
export default function AcceptedMethods({ businessId }) {
  const { data, loading } = useAsync(
    () => (businessId ? getAcceptedMethodSummary(businessId) : Promise.resolve([])),
    [businessId]
  );

  if (loading || !data || data.length === 0) return null;

  return (
    <div className="accepted-methods">
      <span className="accepted-methods__label">Payment Instructions</span>
      <ul className="accepted-methods__list">
        {data.map((method) => {
          const type = sellerPaymentMethodType(method.type);
          return (
            <li key={method.id} className="accepted-methods__item">
              <span aria-hidden="true">{type?.icon || '💳'}</span>
              {method.label || type?.label || 'Payment method'}
            </li>
          );
        })}
      </ul>
      <p className="accepted-methods__hint">
        Full payment details are shown on your order page once the order is placed,
        so they can only ever be seen by you and this seller.
      </p>
    </div>
  );
}
