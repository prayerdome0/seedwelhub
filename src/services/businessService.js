import { createDoc, getById, patchDoc, saveDoc, queryOnce, col } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { serverTimestamp } from '../firebase/firestore';

const COL = COLLECTIONS.BUSINESSES;
const MEMBERS = COLLECTIONS.BUSINESS_MEMBERS;

export function getBusiness(id) {
  return getById(COL, id);
}

export function getBusinessesByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], { orderBy: ['createdAt', 'desc'] });
}

export function getBusinessesByMember(uid) {
  return queryOnce(
    MEMBERS,
    [where('uid', '==', uid), where('status', '==', 'active')],
    { orderBy: ['createdAt', 'desc'] }
  );
}

export async function getFeaturedBusinesses(count = 6) {
  const latest = await queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: 100 });
  const featured = latest.filter((b) => b.isFeatured);
  return featured.slice(0, count);
}

export async function createBusiness(ownerId, data) {
  const doc = await createDoc(COL, {
    ...data,
    ownerId,
    isVerified: false,
    isFeatured: false,
    rating: 0,
    reviewCount: 0,
    status: 'active',
  });
  // Add founder as an active member of the business.
  await createDoc(MEMBERS, {
    businessId: doc.id,
    uid: ownerId,
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
  });
  return doc;
}

export async function updateBusiness(id, data) {
  return patchDoc(COL, id, data);
}

export async function setBusinessVerification(id, isVerified) {
  return patchDoc(COL, id, { isVerified });
}

export async function setBusinessFeatured(id, isFeatured) {
  return patchDoc(COL, id, { isFeatured });
}

export function getBusinessesByCategory(category) {
  return queryOnce(COL, [where('category', '==', category)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getAllBusinesses(count = 60) {
  return queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: count });
}

export function searchBusinesses(term) {
  return queryOnce(COL, [], { orderBy: ['createdAt', 'desc'] }).then((all) =>
    term
      ? all.filter(
          (b) =>
            b.name.toLowerCase().includes(term.toLowerCase()) ||
            (b.category || '').toLowerCase().includes(term.toLowerCase()) ||
            (b.city || '').toLowerCase().includes(term.toLowerCase())
        )
      : all
  );
}
