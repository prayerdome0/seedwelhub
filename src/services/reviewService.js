import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.REVIEWS;

export function getReviewsForBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getReviewsForProduct(productId) {
  return queryOnce(COL, [where('productId', '==', productId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function createReview({
  businessId,
  productId,
  authorId,
  rating,
  comment = '',
  authorName = '',
  authorPhoto = '',
}) {
  return createDoc(COL, {
    businessId,
    productId,
    authorId,
    rating,
    comment,
    authorName,
    authorPhoto,
  });
}

export async function updateReview(id, data) {
  return patchDoc(COL, id, data);
}
