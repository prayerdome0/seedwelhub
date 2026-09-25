import { useEffect, useState } from 'react';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';
import { updateBusiness } from '../../services/businessService';

const DEFAULT_OPTIONS = ['pickup'];

function optionsFor(business) {
  const options = Array.isArray(business?.fulfillmentOptions)
    ? business.fulfillmentOptions.filter((option) => ['delivery', 'pickup'].includes(option))
    : DEFAULT_OPTIONS;
  return options.length ? options : DEFAULT_OPTIONS;
}

export default function FulfillmentSettings({ business }) {
  const { showToast } = useToast();
  const [options, setOptions] = useState(() => optionsFor(business));
  const [deliveryFee, setDeliveryFee] = useState(String(business?.deliveryFee ?? '0'));
  const [deliveryInstructions, setDeliveryInstructions] = useState(business?.deliveryInstructions || '');
  const [pickupInstructions, setPickupInstructions] = useState(business?.pickupInstructions || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOptions(optionsFor(business));
    setDeliveryFee(String(business?.deliveryFee ?? '0'));
    setDeliveryInstructions(business?.deliveryInstructions || '');
    setPickupInstructions(business?.pickupInstructions || '');
  }, [business?.id, business?.deliveryFee, business?.deliveryInstructions, business?.pickupInstructions, business?.fulfillmentOptions]);

  const toggle = (option) => {
    setOptions((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!options.length) {
      showToast('Choose at least one way for customers to receive orders.', 'error');
      return;
    }
    const fee = Math.round(Number(deliveryFee));
    if (options.includes('delivery') && (!Number.isFinite(fee) || fee < 0)) {
      showToast('Enter a valid delivery fee. Use 0 for free delivery.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateBusiness(business.id, {
        fulfillmentOptions: options,
        deliveryFee: options.includes('delivery') ? fee : 0,
        deliveryInstructions: deliveryInstructions.trim(),
        pickupInstructions: pickupInstructions.trim(),
      });
      showToast('Delivery and pickup options saved.', 'success');
    } catch (error) {
      showToast(error.message || 'Could not save fulfillment settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="panel mt-16 fulfillment-settings" onSubmit={save}>
      <h2 className="panel__title">Delivery &amp; pickup</h2>
      <p className="text-muted">
        Set the options buyers can choose at checkout. The delivery fee is included in their total before they place an order.
      </p>

      <div className="fulfillment-settings__options">
        <label className="form__check">
          <input type="checkbox" checked={options.includes('delivery')} onChange={() => toggle('delivery')} />
          <span><strong>Offer delivery</strong><small>Choose a flat fee for each order.</small></span>
        </label>
        <label className="form__check">
          <input type="checkbox" checked={options.includes('pickup')} onChange={() => toggle('pickup')} />
          <span><strong>Offer pickup</strong><small>Buyers collect directly from your business.</small></span>
        </label>
      </div>

      {options.includes('delivery') && (
        <div className="form__group mt-16">
          <label className="form__label" htmlFor="fulfillment-delivery-fee">
            Flat delivery fee ({business?.currency || 'ZMW'})
          </label>
          <input
            id="fulfillment-delivery-fee"
            className="form__input"
            type="number"
            min="0"
            step="1"
            value={deliveryFee}
            onChange={(event) => setDeliveryFee(event.target.value)}
            required
          />
          <span className="form__hint">Enter 0 if delivery is free. This fee is shown in the cart total.</span>
        </div>
      )}

      {options.includes('delivery') && (
        <div className="form__group">
          <label className="form__label" htmlFor="fulfillment-delivery-note">Delivery details (optional)</label>
          <textarea
            id="fulfillment-delivery-note"
            className="form__textarea"
            value={deliveryInstructions}
            onChange={(event) => setDeliveryInstructions(event.target.value)}
            placeholder="Delivery area, typical timeframe or handoff details"
          />
        </div>
      )}

      {options.includes('pickup') && (
        <div className="form__group">
          <label className="form__label" htmlFor="fulfillment-pickup-note">Pickup details (optional)</label>
          <textarea
            id="fulfillment-pickup-note"
            className="form__textarea"
            value={pickupInstructions}
            onChange={(event) => setPickupInstructions(event.target.value)}
            placeholder="Pickup address or collection instructions"
          />
        </div>
      )}

      <Button type="submit" variant="primary" loading={saving}>Save fulfillment options</Button>
    </form>
  );
}
