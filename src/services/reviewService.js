import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS, NOTIFICATION_TYPES } from '../utils/constants';
import { createNotification } from './notificationService';
import { getBusiness } from './businessService';

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
  const review = await createDoc(COL, {
    businessId,
    productId,
    authorId,
    rating,
    comment,
    authorName,
    authorPhoto,
  });

  // Seller activity: let the business owner know a customer left a review.
  // Fire-and-forget so a notification failure never blocks posting a review.
  notifyBusinessOwner({
    businessId,
    productId,
    reviewId: review.id,
    authorId,
    authorName,
    rating,
  }).catch(() => {});

  return review;
}

/**
 * Notifies the business owner about a new review on their business or one of
 * their products. The owner is resolved from the business document (one
 * read); reviews by the owner themselves are skipped.
 */
async function notifyBusinessOwner({ businessId, productId, reviewId, authorId, authorName, rating }) {
  if (!businessId || !authorId) return;
  const business = await getBusiness(businessId).catch(() => null);
  if (!business) return;
  const ownerId = business.ownerId;
  if (!ownerId || ownerId === authorId) return;

  const stars = Math.min(5, Math.max(1, Number(rating) || 0));
  const businessName = String(business.name || '').trim();
  await createNotification({
    recipientId: ownerId,
    title: 'New review ⭐',
    message: `${String(authorName || 'A customer').slice(0, 40)} left a ${stars}-star review${
      businessName ? ` on ${businessName.slice(0, 60)}` : ''
    }.`,
    type: NOTIFICATION_TYPES.BUSINESS,
    related: {
      businessId,
      productId: productId || null,
      reviewId: reviewId || null,
    },
  }).catch(() => {});
}

export async function updateReview(id, data) {
  return patchDoc(COL, id, data);
}
