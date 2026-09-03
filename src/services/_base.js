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

// Shared helpers used by the per-entity services so Firestore access stays in
// one place instead of being scattered through components.

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
  let constraints = [];
  if (options.where) constraints.push(...options.where);
  if (options.orderBy) {
    const [field, dir] = Array.isArray(options.orderBy)
      ? options.orderBy
      : [options.orderBy, 'desc'];
    constraints.push(orderBy(field, dir));
  }
  if (options.limit) constraints.push(limit(options.limit));
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function queryOnce(name, constraints = [], options = {}) {
  const ref = col(name);
  let all = [...constraints];
  if (options.orderBy) {
    const [field, dir] = Array.isArray(options.orderBy)
      ? options.orderBy
      : [options.orderBy, 'desc'];
    all.push(orderBy(field, dir));
  }
  if (options.limit) all.push(limit(options.limit));
  const snap = await getDocs(query(ref, ...all));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

// Cursor (key-set) pagination. Returns documents plus the snapshot cursor that
// can be passed as `cursor` to fetch the next page.
export async function pageQuery(name, constraints = [], options = {}) {
  const ob = options.orderBy || ['createdAt', 'desc'];
  const pageSize = options.pageSize || 12;
  const cursor = options.cursor || null;
  const ref = col(name);
  const all = [...constraints, orderBy(...ob), limit(pageSize)];
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
