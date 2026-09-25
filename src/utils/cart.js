import { currencyCode } from './constants';

// Cart lines from one storefront and currency become one platform order. A
// seller with no business profile is still grouped by its owner ID; currencies
// never get mixed into a single numeric total.
export function groupCartItems(items = []) {
  const map = new Map();
  for (const item of items) {
    if (!item?.productId) continue;
    const currency = currencyCode(item.currency);
    const seller = item.businessId || `owner:${item.ownerId || 'unknown'}`;
    const key = `${seller}::${currency}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        businessId: item.businessId || '',
        ownerId: item.ownerId || '',
        businessName: item.businessName || '',
        currency,
        items: [],
        subtotal: 0,
      });
    }
    const group = map.get(key);
    group.items.push(item);
    group.ownerId ||= item.ownerId || '';
    group.businessName ||= item.businessName || '';
    group.subtotal += (Number(item.price) || 0) * (Number(item.quantity) || 0);
  }
  return [...map.values()];
}

export function getFulfillmentOptions(business) {
  const saved = Array.isArray(business?.fulfillmentOptions)
    ? [...new Set(business.fulfillmentOptions.filter((option) => ['delivery', 'pickup'].includes(option)))]
    : [];
  return saved.length ? saved : ['pickup'];
}
