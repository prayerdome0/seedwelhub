import { queryOnce, createDoc, removeDoc } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.WISHLISTS;

export function getWishlistForUser(uid) {
  return queryOnce(COL, [where('uid', '==', uid)], { orderBy: ['createdAt', 'desc'] });
}

export function getWishlistItem(uid, productId) {
  return queryOnce(
    COL,
    [where('uid', '==', uid), where('productId', '==', productId)],
    { limit: 1 }
  );
}

export async function addToWishlist(uid, product) {
  const existing = await getWishlistItem(uid, product.id || product.productId);
  if (existing.length > 0) return existing[0];
  return createDoc(COL, {
    uid,
    productId: product.id || product.productId,
    product,
  });
}

export async function removeFromWishlist(uid, productId) {
  const items = await getWishlistItem(uid, productId);
  for (const item of items) {
    await removeDoc(COL, item.id);
  }
}
