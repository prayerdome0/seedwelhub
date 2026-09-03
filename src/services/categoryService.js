import { queryOnce } from './_base';
import { orderBy } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.CATEGORIES;

export function getCategories() {
  return queryOnce(COL, [], { orderBy: ['name', 'asc'] });
}

export async function ensureDefaultCategories() {
  const existing = await getCategories();
  if (existing.length > 0) return existing;
  return [];
}
