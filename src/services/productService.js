import { createDoc, getById, patchDoc, queryOnce, pageQuery } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.PRODUCTS;

export function getProduct(id) {
  return getById(COL, id);
}

export function getProductsByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getProductsByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function getFeaturedProducts(count = 8) {
  const latest = await queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: 100 });
  const featured = latest.filter((p) => p.isFeatured);
  return featured.slice(0, count);
}

export function getLatestProducts(count = 12) {
  return queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: count });
}

export function getProductsByCategory(category, count = 12) {
  return queryOnce(COL, [where('category', '==', category)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export async function createProduct(ownerId, data) {
  return createDoc(COL, {
    ...data,
    ownerId,
    isFeatured: false,
    status: 'active',
    rating: 0,
    reviewCount: 0,
    availability: 'available',
  });
}

export async function updateProduct(id, data) {
  return patchDoc(COL, id, data);
}

export async function setProductFeatured(id, isFeatured) {
  return patchDoc(COL, id, { isFeatured });
}

// Simple paginated listing for the marketplace.
export function marketplaceProducts({ cursor, pageSize = 12, category, businessId } = {}) {
  const constraints = [];
  if (category) constraints.push(where('category', '==', category));
  if (businessId) constraints.push(where('businessId', '==', businessId));
  return pageQuery(COL, constraints, {
    orderBy: ['createdAt', 'desc'],
    pageSize,
    cursor,
  });
}

// Client-side search filter after a bounded query. Kept deliberately bounded so
// we never read thousands of documents in one go.
export function searchProducts(term) {
  return queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: 100 }).then(
    (all) =>
      term
        ? all.filter((p) => {
            const haystack = `${p.name || ''} ${p.description || ''} ${
              p.category || ''
            } ${p.businessName || ''}`.toLowerCase();
            return haystack.includes(term.toLowerCase());
          })
        : all
  );
}
