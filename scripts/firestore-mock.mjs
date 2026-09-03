// ---------------------------------------------------------------------------
// A small in-memory stand-in for the Firestore SDK.
//
// It implements only the surface `src/firebase/firestore.js` re-exports and the
// services actually use, which is enough to drive the real service layer
// end-to-end without touching a network or a live project. Registered through
// Vite's `resolve.alias`, so the services under test import it unknowingly and
// their real logic runs unmodified.
// ---------------------------------------------------------------------------

export const store = new Map(); // collectionName -> Map<id, data>

let autoId = 0;
const nextId = () => `id_${String(++autoId).padStart(4, '0')}`;

export function resetStore() {
  store.clear();
  autoId = 0;
}

function bucket(name) {
  if (!store.has(name)) store.set(name, new Map());
  return store.get(name);
}

// ---- references ------------------------------------------------------------
export function collection(_db, name, ...segments) {
  const path = segments.length ? `${name}/${segments.join('/')}` : name;
  return { __type: 'collection', path };
}

export function doc(_db, name, id, ...rest) {
  if (id === undefined) return { __type: 'doc', path: name, id: nextId() };
  const path = rest.length ? `${name}/${id}/${rest.slice(0, -1).join('/')}` : name;
  const docId = rest.length ? rest[rest.length - 1] : id;
  return { __type: 'doc', path, id: docId };
}

// ---- query building --------------------------------------------------------
export const where = (field, op, value) => ({ __c: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ __c: 'orderBy', field, dir });
export const limit = (n) => ({ __c: 'limit', n });
export const startAfter = (cursor) => ({ __c: 'startAfter', cursor });

export function query(ref, ...clauses) {
  return { __type: 'query', ref, clauses: clauses.filter(Boolean) };
}

function getField(data, field) {
  return field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), data);
}

function matches(data, clause) {
  const actual = getField(data, clause.field);
  const { op, value } = clause;
  if (op === '==') return actual === value;
  if (op === '!=') return actual !== value;
  if (op === '>') return actual > value;
  if (op === '>=') return actual >= value;
  if (op === '<') return actual < value;
  if (op === '<=') return actual <= value;
  if (op === 'in') return Array.isArray(value) && value.includes(actual);
  if (op === 'not-in') return Array.isArray(value) && !value.includes(actual);
  if (op === 'array-contains') return Array.isArray(actual) && actual.includes(value);
  if (op === 'array-contains-any')
    return Array.isArray(actual) && value.some((v) => actual.includes(v));
  throw new Error(`Mock Firestore: unsupported operator "${op}"`);
}

function snapshotOf(path, id, data) {
  return {
    id,
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : structuredClone(data)),
    ref: { __type: 'doc', path, id },
  };
}

// ---- reads -----------------------------------------------------------------
export async function getDoc(ref) {
  const data = bucket(ref.path).get(ref.id);
  return snapshotOf(ref.path, ref.id, data);
}

export async function getDocs(refOrQuery) {
  const isQuery = refOrQuery.__type === 'query';
  const ref = isQuery ? refOrQuery.ref : refOrQuery;
  const clauses = isQuery ? refOrQuery.clauses : [];

  let rows = [...bucket(ref.path).entries()].map(([id, data]) => ({ id, data }));

  for (const clause of clauses.filter((c) => c.__c === 'where')) {
    rows = rows.filter((row) => matches(row.data, clause));
  }

  const sorts = clauses.filter((c) => c.__c === 'orderBy');
  for (const sort of [...sorts].reverse()) {
    rows.sort((a, b) => {
      const av = getField(a.data, sort.field);
      const bv = getField(b.data, sort.field);
      const an = av?.toMillis ? av.toMillis() : av;
      const bn = bv?.toMillis ? bv.toMillis() : bv;
      if (an === bn) return 0;
      const cmp = an > bn ? 1 : -1;
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }

  const lim = clauses.find((c) => c.__c === 'limit');
  if (lim) rows = rows.slice(0, lim.n);

  const docs = rows.map((row) => snapshotOf(ref.path, row.id, row.data));
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) };
}

// ---- writes ----------------------------------------------------------------
function resolveValues(target, data) {
  const out = { ...data };
  for (const [key, value] of Object.entries(out)) {
    if (value && value.__sentinel === 'serverTimestamp') out[key] = Timestamp.now();
    else if (value && value.__sentinel === 'increment')
      out[key] = (Number(target?.[key]) || 0) + value.by;
    else if (value && value.__sentinel === 'arrayUnion')
      out[key] = [...new Set([...(target?.[key] || []), ...value.items])];
    else if (value && value.__sentinel === 'arrayRemove')
      out[key] = (target?.[key] || []).filter((v) => !value.items.includes(v));
    else if (value && value.__sentinel === 'deleteField') delete out[key];
  }
  return out;
}

export async function addDoc(ref, data) {
  const id = nextId();
  bucket(ref.path).set(id, resolveValues(undefined, data));
  return { id, path: ref.path };
}

export async function setDoc(ref, data, options = {}) {
  const existing = bucket(ref.path).get(ref.id);
  const resolved = resolveValues(existing, data);
  bucket(ref.path).set(ref.id, options.merge ? { ...existing, ...resolved } : resolved);
}

export async function updateDoc(ref, data) {
  const existing = bucket(ref.path).get(ref.id);
  if (existing === undefined) {
    const error = new Error(`No document to update: ${ref.path}/${ref.id}`);
    error.code = 'not-found';
    throw error;
  }
  bucket(ref.path).set(ref.id, { ...existing, ...resolveValues(existing, data) });
}

export async function deleteDoc(ref) {
  bucket(ref.path).delete(ref.id);
}

export async function runTransaction(_db, updateFn) {
  return updateFn({
    get: getDoc,
    set: (ref, data, options) => setDoc(ref, data, options),
    update: (ref, data) => updateDoc(ref, data),
    delete: (ref) => deleteDoc(ref),
  });
}

export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data, options) => ops.push(() => setDoc(ref, data, options)),
    update: (ref, data) => ops.push(() => updateDoc(ref, data)),
    delete: (ref) => ops.push(() => deleteDoc(ref)),
    commit: async () => { for (const op of ops) await op(); },
  };
}

// ---- sentinels & misc ------------------------------------------------------
export const serverTimestamp = () => ({ __sentinel: 'serverTimestamp' });
export const increment = (by) => ({ __sentinel: 'increment', by });
export const arrayUnion = (...items) => ({ __sentinel: 'arrayUnion', items });
export const arrayRemove = (...items) => ({ __sentinel: 'arrayRemove', items });
export const deleteField = () => ({ __sentinel: 'deleteField' });

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() { return new Timestamp(Math.floor(Date.now() / 1000)); }
  static fromDate(date) { return new Timestamp(Math.floor(date.getTime() / 1000)); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000)); }
  toMillis() { return this.seconds * 1000; }
  toDate() { return new Date(this.toMillis()); }
}

export function onSnapshot(refOrQuery, onNext) {
  getDocs(refOrQuery).then(onNext).catch(() => {});
  return () => {};
}
export function onSnapshotDoc(ref, onNext) {
  getDoc(ref).then(onNext).catch(() => {});
  return () => {};
}

export const db = { __type: 'mock-db' };
export default db;
