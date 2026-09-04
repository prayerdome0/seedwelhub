# Seedwel Hub

**Seedwel Investment Limited** · Buy. Sell. Manage. Grow.

Seedwel Hub is a marketplace and business platform built entirely on **Firebase** for the backend and **Cloudinary** for media. It does **not** use Supabase or any other backend/database service.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, React Router, Vite |
| Backend | Firebase (Auth, Cloud Firestore, Cloud Messaging) |
| Security | Firebase Security Rules / server-side authorization |
| Media | Cloudinary (unsigned `seedwel` upload preset, cloud `nqyylkmd`) |

---

## Project Structure

```
src/
├── assets/                     # real logo.png + watermark logo.png (original files)
├── cloudinary/upload.js        # Cloudinary unsigned uploads (no folders)
├── components/                 # reusable UI (cards, states, toasts, etc.)
├── contexts/                   # Auth, Toast, Notification providers
├── firebase/                   # config, auth, firestore, messaging
├── hooks/                      # useAsync, useDocument, usePagination, useDebounce
├── layouts/                    # MainLayout, AuthLayout, Header, Footer
├── pages/                      # every page (marketplace, commerce, comms, admin)
├── routes/                     # (routing is in App.jsx; pages lazy-loaded)
├── services/                   # per-entity Firestore access (single source)
├── utils/                      # formatters, ids, constants, friendly errors
├── App.jsx
├── index.css
└── main.jsx
public/
└── firebase-messaging-sw.js    # FCM service worker
firestore.rules                 # Firestore security rules
.env.example                    # documented public env vars
```

---

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and adjust as needed. All values are **public** client
config (safe for the browser). Private keys (FCM VAPID private key, Cloudinary
API secret) must stay server-side and are never committed.

### 3. Run

```bash
npm run dev
```

Open the printed URL. The dev server binds to `0.0.0.0` so it works in preview
environments.

### 4. Build

```bash
npm run build
npm run preview
```

---

## Backend Setup (once, in the Firebase console)

1. **Authentication** — enable **Email/Password** sign-in.
2. **Firestore** — create a database; deploy the rules in `firestore.rules`.
3. **Cloud Messaging** — create a Web Push (FCM) project and set the **public
   VAPID key** in `.env` (`VITE_FIREBASE_VAPID_PUBLIC_KEY`). The private key stays
   in the Firebase console. Deploy `firebase-messaging-sw.js` via `public/`.
4. **Cloudinary** — the app uses the existing **unsigned** `seedwel` upload preset
   with cloud `nqyylkmd`. **Cloudinary has no folders** — do not create or require
   any folders. (If the preset is not unsigned, switch it to unsigned in the
   Cloudinary console so client uploads work without an API secret.)

---

## Security Model

- Users map to Firebase Auth UID; the Firestore `users/{uid}` document stores the
  profile and `role`.
- **Default role is `user`.** A normal user can never choose `role: admin` — this
  is enforced by Firestore Security Rules (see `firestore.rules`), never by
  frontend visibility.
- **Making someone an admin:** set `role: 'admin'` on their `users/{uid}`
  document in the Firestore console. `AuthContext` holds a realtime subscription
  to the signed-in user's own document, so the change is detected immediately —
  the Admin tab appears in the header nav (and the profile/dropdown links and
  the `/admin` route guard open up) without logging out and back in. Revoking
  the role works the same way, in reverse.
- Admin operations are gated on both the UI (Admin tab) and the rules
  (`isAdmin()`).
- Private data (orders, payments, conversations, messages, notifications) is only
  readable/writable by the owner, the relevant business/seller, or an admin.
- Quotations, invoices and receipts are world-readable by design: they are shared
  with customers (who may not have accounts) and carry the public verification
  code used by the `/verify/:code` page. Writes stay restricted to the customer,
  the owning business and admins.

---

## Media Uploads

All media (profile photos, logos, cover images, product/service images, post media,
videos, payment proofs, chat images) upload to Cloudinary using the existing
**unsigned** `seedwel` preset. The returned URL is stored in Firestore — media is
**never** stored inside Firestore.

The homepage hero is one full-width banner area built from **five auto-scrolling
professional banners** — Buy, Sell, Services, Connect and Manage &amp; Grow — each
with its own marketplace photograph in `src/assets/banners/`, the official
Seedwel mark (logo + "Buy. Sell. Manage. Grow." lockup) as a separate overlay,
CTAs, and per-banner copy. The carousel auto-plays every few seconds, pauses on
hover/focus, restarts its timer after any manual navigation, and supports
touch/pointer **swipe** plus arrow and dot controls. Dots show the active
banner. Inside the hero, always-visible **feature highlights** (Trusted ·
Connected · Grow · Support), the search bar and the Products / Businesses /
Services **statistics** stay beneath the banners. Everything is responsive
without horizontal overflow; the categories and featured sections below the
hero are untouched.

---

## Feature Map

- **Auth:** register → verify email → login → profile → logout; password reset.
- **Marketplace:** home, marketplace, products, product detail, services, service
  detail, businesses, business profile, search (loading/empty/error/retry states).
- **Location-aware marketplace:** with the user's consent the marketplace
  detects an approximate location (browser geolocation → keyless reverse
  geocoding) or lets the user pick one manually (country → region/province →
  city/town → nearest area). Products, services, businesses and search results
  are then ranked nearest-first — nearest area → same city → same region →
  same country → other locations — while listings from other locations stay
  visible below a "Other locations" divider. A location bar shows
  "Showing {type} near {place}", category/search filters keep working, and
  precise coordinates are never stored, displayed or exposed (only the coarse
  town/country is kept, in localStorage).
- **Commerce:** orders, order detail, order tracking, payments, payment detail,
  quotations, invoices, receipts, document QR verification.
- **Communication:** messages, conversations, groups, group chat — powered by a
  fixed-layout messaging workspace (fixed header, scroll-only message list,
  fixed composer) with replies, reactions, stars/pins, edit/delete, forwarding,
  read receipts, typing & presence, voice notes, attachments with preview +
  caption, emoji/stickers, camera, location sharing, in-conversation search,
  media/starred/pinned panels, mute/block/report, and full group admin
  controls (@mentions, member management, announcements, permissions).
  Threads open on the unread divider (messages below stay unread until you
  reach the bottom); reading older messages never yanks you down — a
  "↓ N new messages" pill returns you to the latest.
- **Notifications:** FCM web push + in-app notification center with tabs and an
  unread-count bell in the header. Covers new orders & order updates,
  quotations, invoices, receipts, payments, payment confirmations, payment
  proof submitted/rejected, new reviews (seller activity), **new direct
  messages and replies** (per-conversation mute/block honoured; recipients
  actively reading a thread are not spammed), **group messages** ("New message
  in {group}" / "{name} replied in {group}"), and **account alerts** (e.g. a
  password reset was requested). Every notification opens the exact page it
  refers to (order, payment,
  message thread, group, document…), supports mark-as-read and mark-all-as-read,
  and per-category preferences live in Settings → Notifications. Background
  delivery uses the FCM service worker; actual push dispatch stays server-side
  (FCM Admin/Cloud Function) with tokens stored in `deviceTokens`.
- **Promotions & deals:** sellers schedule discounts from the Seller Dashboard →
  **Promotions** tab (percentage *or* fixed new price, product picker, start/end
  date & time, promotion image, description, enable/disable, live
  Was / Now / Save / % preview). Seedwel Hub starts a promotion at its scheduled
  time, counts it down ("Ends in 2h 35m") and stops it at the end time —
  expired promotions disappear from every shopper-facing surface automatically.
  Sellers can also publish a **promotional banner** that rides the same
  schedule and appears in the homepage hero carousel. The homepage merchandises
  the results as 🔥 Best Deals, ⚡ Flash Deals (ending within 24h),
  🏷️ Discounts from 10% Off, 📢 Seller Promotions, 📍 Deals Near You and
  🆕 New Arrivals, with a full `/deals` catalogue filterable by discount depth.
  See *Promotion integrity* below for how the pricing is protected.
- **Admin:** dashboard, users, businesses, products, orders, payments, reports,
  verification, security.
- **Global:** 404 page + React Error Boundary; every Firebase page has loading /
  empty / error / success / not-found states.

---

## Promotion integrity (promotions are never trusted from the browser)

A promotion decides what a buyer pays, so it is never taken at face value from
the stored document. Three layers cooperate:

1. **`src/utils/promotions.js`** — pure domain logic and the single source of
   truth for promotional pricing. `computePricing()` refuses anything that is
   not a genuine reduction (a "new price" at or above the original, a 0% or
   negative discount, a discount above 90%, a non-numeric price). Money is
   rounded to whole units so `Was − Now === Save` always holds on screen.
2. **`src/services/promotionService.js`** — every read runs each document
   through `resolvePromotion()`, which **recomputes** the price from
   `(originalPrice, type, value)` and **re-checks the schedule against the
   reader's clock**. The stored `status`, `promoPrice` and `savings` fields are
   ignored. A promotion whose document still says `"active"` but whose end time
   has passed resolves to `expired` and vanishes from the UI. `applyPromotion()`
   additionally clamps the "Was" figure to the product's own list price, so a
   seller cannot inflate the original price after the fact to fake a bigger
   saving.
3. **`firestore.rules` → `/promotions`, `/promoBanners`** — the enforcement
   layer. Only the owning seller (verified against the business document via
   `ownsBusiness()`) may write, ownership cannot be transferred by an update,
   and a document is rejected outright unless
   `0 < promoPrice < originalPrice`, `1 ≤ discountPercent ≤ 90`, and both
   `startAt` and `endAt` are present.

`npm run verify` runs `scripts/verify-promotions.mjs`, which locks all of the
above in — including the anti-tamper cases (inflated "Was" price, forged
`status: active`, tampered `promoPrice`) and every schedule transition.

---

## Email deliverability (verification emails landing in Spam)

The verification screen now tells people to check **Inbox** *and*
**Spam/Junk**, and offers concrete "can't find it?" guidance. **This is a
mitigation, not the fix.** Firebase Authentication's default sender
(`noreply@<project>.firebaseapp.com`) is a shared domain that you do not control
and cannot authenticate, which is why Gmail and Outlook are quick to filter it.

To actually fix deliverability, move to a custom authenticated sending domain:

1. **Use your own domain** for sending (e.g. `no-reply@seedwelhub.com`) — a real,
   professional sender address, not a shared Firebase subdomain.
2. **SPF** — publish a TXT record authorising your sending service's servers.
3. **DKIM** — publish the provider's public key and enable signing so each
   message is cryptographically verifiable.
4. **DMARC** — publish a policy (start at `p=none` with `rua=` reporting, then
   tighten to `quarantine`/`reject` once SPF+DKIM pass consistently).
5. **Configure the sender in Firebase:** Authentication → Templates →
   customise the sender name/address and the reply-to, and (for full control of
   the template and headers) point the action URL at your own domain.
6. **Keep the template clean:** a clear subject, real text, few links, no
   all-caps or spam-trigger phrasing, and a plain-text alternative.
7. **Rate-limit resends** so a user cannot trigger a burst of identical
   verification emails — bursts hurt domain reputation.
8. **Test before trusting it:** send to Gmail, Outlook, Yahoo and a corporate
   mailbox, and check the results with a seed-test tool (mail-tester or similar)
   to confirm SPF/DKIM/DMARC all pass.

For full control, send verification mail through a dedicated provider
(SendGrid, Mailgun, Postmark, SES) from a Cloud Function using
`generateEmailVerificationLink()` from the Firebase Admin SDK, rather than
Firebase's built-in sender.

---

## Composite Firestore Indexes — not required

Firestore only serves a `where` filter combined with an `orderBy` on a different
field if a matching **composite index** exists for that collection/field pair.
Missing indexes used to break the seller dashboard, groups, notifications and
most list screens with a `failed-precondition` ("The query requires an index")
error.

The app now avoids composite indexes entirely. The shared query helpers in
`src/services/_base.js` (`queryOnce`, `listAll`, `pageQuery`) apply this policy
automatically:

- **Unfiltered queries** keep `orderBy` + `limit` server-side — single-field
  indexes are automatic in Firestore.
- **Filtered queries** are sent with the `where` filters only, then ordered and
  limited **client-side** (a `limit` without an `orderBy` stays server-side).
- **Filtered pagination** (marketplace category filter) fetches the filtered set,
  sorts locally and pages by numeric offset; unfiltered pagination keeps real
  key-set (`startAfter`) pagination.

No console index setup is needed — deploy and everything works. If you later
prefer server-side ordering at scale, you can create composite indexes in the
Firebase console (Firestore → Indexes) and the helpers will still work; they are
an optimization boundary, not a correctness one.

---

## Notes

- The build splits Firebase, React, and vendor code into separate chunks.
- Collections are created only as required by implemented features.
- No Supabase, no second database, no Cloudinary folders.
