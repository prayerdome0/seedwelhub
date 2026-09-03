import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.SERVICES;

export function getService(id) {
  return getById(COL, id);
}

export function getServicesByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getServicesByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getLatestServices(count = 12) {
  return queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: count });
}

export function getServicesByCategory(category) {
  return queryOnce(COL, [where('category', '==', category)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function createService(ownerId, data) {
  return createDoc(COL, {
    ...data,
    ownerId,
    status: 'active',
    availability: 'available',
    rating: 0,
    reviewCount: 0,
  });
}

export async function updateService(id, data) {
  return patchDoc(COL, id, data);
}

export function searchServices(term) {
  return queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: 100 }).then(
    (all) =>
      term
        ? all.filter((s) => {
            const haystack = `${s.name || ''} ${s.description || ''} ${
              s.category || ''
            } ${s.businessName || ''}`.toLowerCase();
            return haystack.includes(term.toLowerCase());
          })
        : all
  );
}
