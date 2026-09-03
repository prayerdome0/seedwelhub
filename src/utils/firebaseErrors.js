// Turn raw Firestore/Auth errors into safe, friendly messages that never leak
// technical internals to users.

const FIRESTORE_MESSAGES = {
  'permission-denied':
    'You do not have permission to view this. Please sign in or contact the owner.',
  'unauthenticated': 'Please sign in to continue.',
  'not-found': 'The requested item was not found.',
  'resource-exhausted': 'Too many requests. Please try again shortly.',
  'unavailable': 'Service is temporarily unavailable. Please try again.',
  'invalid-argument': 'The request was invalid. Please go back and try again.',
  'aborted': 'The operation was aborted. Please try again.',
  'cancelled': 'The operation was cancelled. Please try again.',
  'deadline-exceeded': 'The request timed out. Please try again.',
};

export function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const code = error.code || error.message || '';
  if (FIRESTORE_MESSAGES[code]) return FIRESTORE_MESSAGES[code];
  if (/permission/i.test(code)) return FIRESTORE_MESSAGES['permission-denied'];
  if (/network|failed|unavailable|not reachable/i.test(code)) {
    return 'Network problem. Please check your connection and retry.';
  }
  return error.message || 'Something went wrong. Please try again.';
}
