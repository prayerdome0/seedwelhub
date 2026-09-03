// Device / push notification token access.
//
// The app registers a Firebase Cloud Messaging token in the browser and stores
// the public token in `deviceTokens`. The actual FCM send is handled by a
// trusted server-side service (Cloud Function / FCM Admin SDK) because the
// private VAPID key must never be shipped to the browser. This module only
// manages the public token records used by that server to address each user's
// device.

import { createDoc, getById, saveDoc, removeDoc, queryOnce } from './_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { serverTimestamp } from '../firebase/firestore';

const COL = COLLECTIONS.DEVICE_TOKENS;

// One stable record per signed-in user. A single browser can hold one FCM
// token; refreshing the token overwrites the record instead of accumulating
// stale ones.
const deviceDocId = (uid) => `device_${uid}`;

export function getDeviceTokensForUser(uid, count = 20) {
  return queryOnce(COL, [where('uid', '==', uid)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export async function getActiveDeviceToken(uid) {
  const tokens = await getDeviceTokensForUser(uid, 1);
  return tokens.find((token) => token.active !== false) || null;
}

export async function saveDeviceToken(uid, token) {
  const id = deviceDocId(uid);
  const existing = await getById(COL, id);

  // If the legacy timestamped records already exist, leave them in place and
  // write the stable record as the current device token.
  if (existing && existing.token === token) {
    return existing;
  }

  const payload = {
    uid,
    token,
    platform: 'web',
    active: true,
    subscribedAt: serverTimestamp(),
  };

  if (existing) {
    return saveDoc(COL, id, payload);
  }

  return createDoc(COL, payload, id);
}

export async function deleteDeviceTokensForUser(uid) {
  const tokens = await getDeviceTokensForUser(uid, 100);
  const results = [];
  for (const token of tokens) {
    // Stable id plus any legacy timestamped records.
    // eslint-disable-next-line no-await-in-loop
    results.push(await removeDoc(COL, token.id).catch(() => null));
  }

  const stableId = deviceDocId(uid);
  if (!tokens.some((token) => token.id === stableId)) {
    results.push(await removeDoc(COL, stableId).catch(() => null));
  }

  return results;
}
