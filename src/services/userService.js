import { docRef, getById, saveDoc, patchDoc, queryOnce, col } from './_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS, DEFAULT_ROLE, ACCOUNT_STATUS } from '../utils/constants';
import { serverTimestamp } from '../firebase/firestore';

const COL = COLLECTIONS.USERS;
const PROFILES = COLLECTIONS.PROFILES;

// Creates (or reconciles) the Firestore user document that maps 1:1 to the
// Firebase Auth UID. A normal user can never choose their own role; the role
// defaults to "user" and is only changed through secure server-side/cloud rules.
export async function ensureUserDocument(uid, { email, name = '', photoURL = '' } = {}) {
  const ref = docRef(COL, uid);
  const existing = await getById(COL, uid);
  if (existing) {
    return existing;
  }

  const payload = {
    uid,
    name: name || '',
    email: email || '',
    phone: '',
    username: '',
    photoURL,
    role: DEFAULT_ROLE,
    accountStatus: ACCOUNT_STATUS.ACTIVE,
    emailVerified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await saveDoc(COL, uid, payload);

  // Also mirror onto the profiles collection for profile-related pages.
  await saveDoc(PROFILES, uid, {
    uid,
    name: payload.name,
    email: payload.email,
    username: '',
    bio: '',
    location: '',
    photoURL,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: uid, ...payload };
}

export async function getUser(uid) {
  return getById(COL, uid);
}

export async function getUserProfile(uid) {
  const profile = await getById(PROFILES, uid);
  if (profile) return profile;
  return getById(COL, uid);
}

export async function updateUser(uid, data) {
  return patchDoc(COL, uid, data);
}

export async function updateProfile(uid, data) {
  await patchDoc(PROFILES, uid, data);
  return patchDoc(COL, uid, data);
}

export async function setRole(uid, role) {
  // This is intended for authorized admin paths. Frontend-only calls can never
  // escalate: Firestore rules reject non-admin writes to the role field.
  return patchDoc(COL, uid, { role });
}

export async function getUsersByRole(role) {
  return queryOnce(COL, [where('role', '==', role)]);
}

export async function safeUsersByEmail(email) {
  return queryOnce(COL, [where('email', '==', email)], { limit: 1 });
}

export function getUserRef(uid) {
  return docRef(COL, uid);
}
