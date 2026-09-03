# Verification suites

```bash
npm run verify
```

Runs every check below through Vite, so the app's own module resolution
(extensionless imports, JSX, aliases) applies exactly as it does at runtime.
No Firebase project, network access or browser is required.

| Suite | What it covers |
| --- | --- |
| `verify-documents.mjs` | `buildDocument()` normalisation for all five document types: numbering, seller/buyer blocks, item maths, tax, discounts, delivery, totals, legacy invoice status mapping, and missing-data edge cases. |
| `verify-navigation.mjs` | Main-menu and account-menu visibility per role (guest / buyer / unverified seller / verified seller / admin), and notification → route deep linking. |
| `verify-security.mjs` | The payment-detail disclosure gate, document-number format, and the invoice / quotation / proof / risk status ladders. |
| `verify-render.mjs` | Real React renders of `DocumentView`, `MenuLink` and `Drawer` in a jsdom DOM — checks the rendered markup rather than just the data. |
| `verify-flows.mjs` | The two end-to-end workflows, running the **real service layer** against an in-memory Firestore. |

## The Firestore mock

`firestore-mock.mjs` implements the slice of the Firestore SDK that
`src/firebase/firestore.js` re-exports (refs, queries, `getDoc`/`getDocs`,
writes, sentinels, `runTransaction`, `writeBatch`, `Timestamp`). The runner
aliases the firebase module to it for the flow suite only, so services execute
their genuine logic — status transitions, receipt generation, notification
fan-out — with no live project.

## What the flow suite proves

**Flow A — order → payment → proof → confirmation → receipt**

- A new order is never born paid.
- Checkout shows only channel *names*; account numbers are not in that payload.
- Full payment details go to the order's real buyer, and to nobody else.
- **Uploading a proof does not mark the order paid and issues no receipt.**
- The transaction reference is recorded, the seller is notified, and the proof
  enters the review queue.
- Only after the seller confirms does the order become paid, a `SH-RCP-…`
  receipt generate with a verification code, and the buyer get notified.
- A *rejected* proof leaves the order unpaid with no receipt.

**Flow B — quotation request → seller → quotation → buyer**

Request captured verbatim → seller notified → clarify → accept → priced and
sent as `SH-QUO-…` → buyer notified → viewed → accepted → seller notified.
The resulting document is asserted to carry seller info, buyer info, items,
valid-until, delivery, correct totals, terms and seller notes.

**Flow C — invoice lifecycle**

`DRAFT → SENT → VIEWED → PARTIALLY PAID → PAID`, with buyer notification on
send and balance tracking across part payments.
