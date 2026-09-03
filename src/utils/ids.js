// Generates human-friendly business document identifiers and short unique codes.

function pad(number, length = 4) {
  return String(number).padStart(length, '0');
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function generateOrderNumber(sequence = 0) {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1, 2);
  const dd = pad(date.getDate(), 2);
  return `ORD-${yyyy}${mm}${dd}-${pad(sequence || Math.floor(Math.random() * 9999), 4)}`;
}

export function generateQuoteNumber(sequence = 0) {
  const date = new Date();
  return `QUO-${date.getFullYear()}${pad(date.getMonth() + 1, 2)}-${pad(
    sequence || Math.floor(Math.random() * 9999),
    4
  )}`;
}

export function generateInvoiceNumber(sequence = 0) {
  const date = new Date();
  return `INV-${date.getFullYear()}${pad(date.getMonth() + 1, 2)}-${pad(
    sequence || Math.floor(Math.random() * 9999),
    4
  )}`;
}

export function generateReceiptNumber(sequence = 0) {
  const date = new Date();
  return `RCP-${date.getFullYear()}${pad(date.getMonth() + 1, 2)}-${pad(
    sequence || Math.floor(Math.random() * 9999),
    4
  )}`;
}

export function generateVerificationCode() {
  // A short, hard-to-guess public identifier used for documents/QR verification.
  const rnd =
    Math.random().toString(36).slice(2, 8) + randomSuffix() + Date.now().toString(36).slice(-4);
  return rnd.toUpperCase();
}

export function generateConversationId(userA, userB) {
  return [userA, userB].sort().join('_');
}

export function generatePaymentReference() {
  return `PAY-${randomSuffix()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}
