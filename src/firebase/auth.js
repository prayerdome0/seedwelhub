import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  applyActionCode,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { app } from './config';

// Single shared Firebase Authentication instance. If you need to use auth in a
// component, prefer the useAuth hook so that this instance is never duplicated.
export const auth = getAuth(app);

export function createUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function syncProfile({ displayName, photoURL }) {
  const user = auth.currentUser;
  if (!user) return Promise.resolve(null);
  return updateProfile(user, { displayName, photoURL });
}

export function sendPasswordReset(email) {
  return firebaseSendPasswordResetEmail(auth, email);
}

export function sendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) return Promise.reject(new Error('Not signed in.'));
  return sendEmailVerification(user);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function applyEmailVerification(code) {
  return applyActionCode(auth, code);
}

export async function checkEmailExists(email) {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch (error) {
    return false;
  }
}

// Maps raw Firebase Auth error codes to friendly, user-facing messages.
// We never surface raw Firebase error codes to users.
export const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'Account not found. Please check your email address.',
  'auth/wrong-password': 'Incorrect email/password. Please try again.',
  'auth/invalid-credential': 'Incorrect email/password. Please try again.',
  'auth/invalid-login-credentials': 'Incorrect email/password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
  'auth/weak-password': 'Your password must be at least 6 characters long.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network problem. Please check your connection and retry.',
  'auth/popup-closed-by-user': 'The sign-in window was closed. Please try again.',
  'auth/operation-not-allowed': 'This sign-in method is currently not allowed.',
  'auth/requires-recent-login': 'Please sign in again before performing this action.',
};

export function friendlyAuthError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const code = error.code || error.message;
  return AUTH_ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';
}

export function isEmailVerified() {
  const user = auth.currentUser;
  return Boolean(user && user.emailVerified);
}
