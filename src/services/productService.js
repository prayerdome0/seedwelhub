import { createDoc, getById, patchDoc, removeDoc, queryOnce, pageQuery } from './_base';
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

export function deleteProduct(id) {
  return removeDoc(COL, id);
}

// Bulk create for the CSV importer. Rows are saved one at a time so one bad
// row cannot abort the whole import; failures come back with their line number.
export async function bulkCreateProducts(ownerId, businessId, businessName, rows) {
  const results = { created: 0, failed: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      // eslint-disable-next-line no-await-in-loop
      await createProduct(ownerId, { ...row, businessId, businessName });
      results.created += 1;
    } catch (err) {
      results.failed.push({ row: i + 2, message: err.message || 'Could not save this row.' });
    }
  }
  return results;
}
