import { createDoc, getById, patchDoc, removeDoc, queryOnce } from './_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.INVENTORY;
const MOVEMENTS = COLLECTIONS.INVENTORY_MOVEMENTS;

export function getInventoryItem(id) {
  return getById(COL, id);
}

export function getInventoryByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getInventoryByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function createInventoryItem(ownerId, data) {
  return createDoc(COL, {
    ...data,
    ownerId,
    quantity: Number(data.quantity) || 0,
    lowStockAlert: Number(data.lowStockAlert) || 0,
    status: 'active',
  });
}

export function updateInventoryItem(id, data) {
  return patchDoc(COL, id, data);
}

export function deleteInventoryItem(id) {
  return removeDoc(COL, id);
}

// Adjusts stock by a delta and records the movement for auditability.
export async function adjustStock(item, delta, reason = 'manual adjustment', uid = null) {
  const next = Math.max(0, (Number(item.quantity) || 0) + Number(delta));
  await patchDoc(COL, item.id, { quantity: next });
  await createDoc(MOVEMENTS, {
    inventoryId: item.id,
    businessId: item.businessId || null,
    sku: item.sku || null,
    delta: Number(delta),
    quantityAfter: next,
    reason,
    uid,
  });
  return next;
}

export function getMovementsByBusiness(businessId, count = 50) {
  return queryOnce(MOVEMENTS, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function isLowStock(item) {
  const qty = Number(item?.quantity) || 0;
  const threshold = Number(item?.lowStockAlert) || 0;
  return threshold > 0 && qty <= threshold;
}

// Bulk create — used by the CSV importer. Rows are created sequentially so a
// single bad row does not abort everything; failures are reported back.
export async function bulkCreateInventory(ownerId, businessId, businessName, rows) {
  const results = { created: 0, failed: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      // eslint-disable-next-line no-await-in-loop
      await createInventoryItem(ownerId, { ...row, businessId, businessName });
      results.created += 1;
    } catch (err) {
      results.failed.push({ row: i + 2, message: err.message || 'Could not save this row.' });
    }
  }
  return results;
}
