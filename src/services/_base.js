import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
} from '../firebase/firestore';
import { db } from '../firebase/firestore';
import { timestampMillis } from '../utils/format';

// Shared helpers used by the per-entity services so Firestore access stays in
// one place instead of being scattered through components.
//
// IMPORTANT — index-free querying:
// A Firestore query that combines an equality filter (where) with an orderBy on
// a different field requires a *composite* index for that collection/field
// pair. On a project without those manually created indexes the query fails at
// runtime with `failed-precondition` ("The query requires an index"), which is
// what broke the seller dashboard, messages-adjacent pages and most list
// screens. To keep the app working with zero console setup, any query that has
// filters is executed with the filters only, then ordered and limited
// client-side. Unfiltered queries keep the server-side orderBy/limit because
// single-field indexes are automatic.

export function col(name) {
  return collection(db, name);
}

export function docRef(name, id) {
  return doc(db, name, id);
}

export function subCol(name, docId, subName) {
  return collection(db, name, docId, subName);
}

export function colRef(name, ...segments) {
  return collection(db, name, ...segments);
}

function normalizeOrderBy(option) {
  if (!option) return null;
  const [field, dir] = Array.isArray(option) ? option : [option, 'desc'];
  return [field, dir === 'asc' ? 'asc' : 'desc'];
}

function isTimestampLike(value) {
  return (
    Boolean(value) &&
    (typeof value.toMillis === 'function' ||
      typeof value.toDate === 'function' ||
      typeof value?.seconds === 'number' ||
      value instanceof Date)
  );
}

// Orders documents client-side. Handles Firestore Timestamps (and serialized
// timestamps) as well as plain numbers/strings.
function sortDocs(docs, field, direction) {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...docs].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (isTimestampLike(av) || isTimestampLike(bv)) {
      return (timestampMillis(av) - timestampMillis(bv)) * multiplier;
    }
    if (av === bv) return 0;
    if (av === null || av === undefined) return -multiplier;
    if (bv === null || bv === undefined) return multiplier;
    return (av < bv ? -1 : 1) * multiplier;
  });
}

export async function createDoc(name, data, id = null) {
  const payload = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (id) {
    await setDoc(docRef(name, id), payload);
    return { id, ...payload };
  }
  const ref = await addDoc(col(name), payload);
  return { id: ref.id, ...payload };
}

export async function getById(name, id) {
  const snap = await getDoc(docRef(name, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function saveDoc(name, id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  await setDoc(docRef(name, id), payload, { merge: true });
  return { id, ...payload };
}

export async function patchDoc(name, id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(docRef(name, id), payload);
  return { id, ...payload };
}

export async function removeDoc(name, id) {
  await deleteDoc(docRef(name, id));
  return id;
}

export async function listAll(name, options = {}) {
  const ref = col(name);
  const whereConstraints = options.where || [];
  const order = normalizeOrderBy(options.orderBy);

  // No filters: single-field indexes cover orderBy + limit server-side.
  if (!whereConstraints.length) {
    let constraints = [];
    if (order) constraints.push(orderBy(order[0], order[1]));
    if (options.limit) constraints.push(limit(options.limit));
    const snap = await getDocs(constraints.length ? query(ref, ...constraints) : ref);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // With filters: avoid the composite index by ordering client-side. A limit
  // without an orderBy is safe server-side (no index needed), so it is only
  // pulled client-side when it must apply after the local sort.
  const serverConstraints = [...whereConstraints];
  if (options.limit && !order) serverConstraints.push(limit(options.limit));
  const snap = await getDocs(query(ref, ...serverConstraints));
  let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (order) {
    docs = sortDocs(docs, order[0], order[1]);
    if (options.limit) docs = docs.slice(0, options.limit);
  }
  return docs;
}

export async function queryOnce(name, constraints = [], options = {}) {
  const ref = col(name);
  const order = normalizeOrderBy(options.orderBy);

  // No filters: single-field indexes cover orderBy + limit server-side.
  if (!constraints.length) {
    let all = [];
    if (order) all.push(orderBy(order[0], order[1]));
    if (options.limit) all.push(limit(options.limit));
    const snap = await getDocs(all.length ? query(ref, ...all) : ref);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // With filters: a server-side orderBy on another field would require a
  // composite index, so the ordering happens locally instead. A limit without
  // an orderBy stays server-side (single-field indexes are enough).
  const serverConstraints = [...constraints];
  if (options.limit && !order) serverConstraints.push(limit(options.limit));
  const snap = await getDocs(query(ref, ...serverConstraints));
  let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (order) {
    docs = sortDocs(docs, order[0], order[1]);
    if (options.limit) docs = docs.slice(0, options.limit);
  }
  return docs;
}

export function subscribe(name, constraints = [], { onData, onError }) {
  const ref = col(name);
  const snap = onSnapshot(query(ref, ...constraints), {
    next: (s) =>
      onData(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    error: (err) => onError && onError(err),
  });
  return snap;
}

export function subscribeDoc(name, id, { onData, onError }) {
  return onSnapshot(docRef(name, id), {
    next: (s) => onData(s.exists() ? { id: s.id, ...s.data() } : null),
    error: (err) => onError && onError(err),
  });
}

// Cursor (key-set) pagination. Returns documents plus a cursor that can be
// passed as `cursor` to fetch the next page.
//
// Unfiltered pages use real key-set pagination server-side (single-field
// index). Filtered pages avoid the composite index by fetching the filtered
// set, ordering client-side and paginating by numeric offset.
export async function pageQuery(name, constraints = [], options = {}) {
  const order = normalizeOrderBy(options.orderBy) || ['createdAt', 'desc'];
  const pageSize = options.pageSize || 12;
  const cursor = options.cursor || null;
  const ref = col(name);

  if (!constraints.length) {
    const all = [orderBy(order[0], order[1]), limit(pageSize)];
    const snap = await getDocs(
      cursor ? query(ref, ...all, startAfter(cursor)) : query(ref, ...all)
    );
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return {
      docs,
      nextCursor:
        snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
      done: snap.docs.length < pageSize,
    };
  }

  const snap = await getDocs(query(ref, ...constraints));
  const sorted = sortDocs(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    order[0],
    order[1]
  );
  const offset = typeof cursor === 'number' && cursor > 0 ? cursor : 0;
  const page = sorted.slice(offset, offset + pageSize);
  const next = offset + page.length;
  return {
    docs: page,
    nextCursor: page.length === pageSize && next < sorted.length ? next : null,
    done: next >= sorted.length,
  };
}
