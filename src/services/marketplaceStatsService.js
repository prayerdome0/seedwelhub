import { countDocuments } from './_base';
import { COLLECTIONS } from '../utils/constants';

/**
 * Fetch accurate, public marketplace totals without loading whole collections.
 * Firestore aggregation queries return counts directly, so these figures do
 * not inherit the homepage's deliberately bounded product/business/service
 * card queries.
 */
export async function getMarketplaceStats() {
  const [products, businesses, services] = await Promise.all([
    countDocuments(COLLECTIONS.PRODUCTS),
    countDocuments(COLLECTIONS.BUSINESSES),
    countDocuments(COLLECTIONS.SERVICES),
  ]);

  return { products, businesses, services };
}
