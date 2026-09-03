import { doc, runTransaction, serverTimestamp } from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { DOCUMENT_PREFIXES, DOCUMENT_TYPES } from '../utils/constants';
import { formatDocumentNumber, fallbackSequence } from '../utils/ids';

// ---------------------------------------------------------------------------
// Sequential, gap-free document numbering.
//
// Every Seedwel Hub document (receipt, invoice, quotation, payment and order
// confirmation) is numbered `SH-<TYPE>-000001`. The counter lives in a single
// document per type under `counters/{type}` and is incremented inside a
// Firestore transaction, so two sellers checking out at the same moment can
// never be handed the same number.
//
// If the counter cannot be read or written (offline, or rules not yet
// deployed) we fall back to a clock-derived sequence instead of failing the
// whole checkout — a receipt with an unusual number is far better than a paid
// order with no receipt at all.
// ---------------------------------------------------------------------------

const COUNTERS = 'counters';

export async function nextDocumentNumber(type) {
  const prefix = DOCUMENT_PREFIXES[type] || 'SH-DOC';
  try {
    const ref = doc(db, COUNTERS, type);
    const sequence = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const current = snap.exists() ? Number(snap.data().value) || 0 : 0;
      const next = current + 1;
      transaction.set(
        ref,
        { type, value: next, prefix, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return next;
    });
    return { number: formatDocumentNumber(prefix, sequence), sequence };
  } catch {
    const sequence = fallbackSequence();
    return { number: formatDocumentNumber(prefix, sequence), sequence };
  }
}

export function nextReceiptNumber() {
  return nextDocumentNumber(DOCUMENT_TYPES.RECEIPT);
}

export function nextInvoiceNumber() {
  return nextDocumentNumber(DOCUMENT_TYPES.INVOICE);
}

export function nextQuotationNumber() {
  return nextDocumentNumber(DOCUMENT_TYPES.QUOTATION);
}

export function nextPaymentNumber() {
  return nextDocumentNumber(DOCUMENT_TYPES.PAYMENT_CONFIRMATION);
}
