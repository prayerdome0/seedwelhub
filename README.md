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
- Admin operations are gated on both the UI (Admin tab) and the rules
  (`isAdmin()`).
- Private data (orders, payments, conversations, messages, notifications) is only
  readable/writable by the owner, the relevant business/seller, or an admin.

---

## Media Uploads

All media (profile photos, logos, cover images, product/service images, post media,
videos, payment proofs, chat images) upload to Cloudinary using the existing
**unsigned** `seedwel` preset. The returned URL is stored in Firestore — media is
**never** stored inside Firestore.

The homepage hero also includes a small set of optimized, locally bundled real
marketplace photographs in `src/assets/banners/`. They are used as presentation
imagery and carry the official Seedwel mark as a separate overlay, so the source
photos remain unmodified.

---

## Feature Map

- **Auth:** register → verify email → login → profile → logout; password reset.
- **Marketplace:** home, marketplace, products, product detail, services, service
  detail, businesses, business profile, search (loading/empty/error/retry states).
- **Commerce:** orders, order detail, order tracking, payments, payment detail,
  quotations, invoices, receipts, document QR verification.
- **Communication:** messages, conversations, groups, group chat.
- **Notifications:** FCM web push + in-app notification center with tabs.
- **Admin:** dashboard, users, businesses, products, orders, payments, reports,
  verification, security.
- **Global:** 404 page + React Error Boundary; every Firebase page has loading /
  empty / error / success / not-found states.

---

## Composite Firestore Indexes

A handful of pages combine a `where` filter with an `orderBy` sort. Firebase
requires a matching **composite index** for those queries. Create them in the
Firebase console (Firestore → Indexes) as prompted by the console, or add them to
`firestore.indexes.json`. The key ones:

- `businesses` — `ownerId ASC, createdAt DESC`
- `businesses` — `category ASC, createdAt DESC` (where used)
- `products` — `businessId ASC, createdAt DESC`
- `products` — `category ASC, createdAt DESC`
- `products` — `ownerId ASC, createdAt DESC`
- `services` — `businessId ASC, createdAt DESC`
- `services` — `category ASC, createdAt DESC`
- `orders` — `buyerId ASC, createdAt DESC`
- `orders` — `businessId ASC, createdAt DESC`
- `payments` — `buyerId ASC, createdAt DESC`
- `payments` — `businessId ASC, createdAt DESC`
- `payments` — `status ASC, createdAt DESC`
- `conversations` — `participantIds ARRAY_CONTAINS, lastMessageAt DESC`
- `messages` — `conversationId ASC, createdAt ASC`
- `quotations` / `invoices` / `receipts` — `businessId ASC, createdAt DESC`
- `reviews` — `businessId ASC, createdAt DESC`
- `notifications` — `recipientId ASC, createdAt DESC`

The home page's "featured" sections intentionally avoid compound queries so the
site loads cleanly even before indexes are created. The direct Messages inbox and
conversation view also use single-field filters and sort their small result sets
in the client, so a missing conversations/messages index does not block chat.

---

## Notes

- The build splits Firebase, React, and vendor code into separate chunks.
- Collections are created only as required by implemented features.
- No Supabase, no second database, no Cloudinary folders.
