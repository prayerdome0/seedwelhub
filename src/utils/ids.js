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

// ---------------------------------------------------------------------------
// Seedwel Hub document numbers — `SH-RCP-000001` style.
//
// The canonical, gap-free sequence is allocated transactionally by
// documentNumberService.nextDocumentNumber(). This helper builds the string
// from an already-allocated sequence, and is also used as the offline/fallback
// path (where the sequence is derived from the clock so it stays unique and
// monotonic even if the counter document cannot be read).
// ---------------------------------------------------------------------------
export function formatDocumentNumber(prefix, sequence) {
  return `${prefix}-${pad(sequence, 6)}`;
}

export function fallbackSequence() {
  // Monotonic-ish, collision-resistant sequence for the rare case where the
  // transactional counter is unavailable. Uses the seconds-since-epoch tail so
  // the number still sorts chronologically.
  return Number(String(Math.floor(Date.now() / 1000)).slice(-6));
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
