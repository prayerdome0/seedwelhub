import { queryOnce, getById, patchDoc } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { serverTimestamp } from '../firebase/firestore';

export function getTotalUsers() {
  return queryOnce(COLLECTIONS.USERS, []);
}

export function getTotalBusinesses() {
  return queryOnce(COLLECTIONS.BUSINESSES, []);
}

export function getTotalProducts() {
  return queryOnce(COLLECTIONS.PRODUCTS, []);
}

export function getTotalOrders() {
  return queryOnce(COLLECTIONS.ORDERS, []);
}

export function getTotalPayments() {
  return queryOnce(COLLECTIONS.PAYMENTS, []);
}

export function getRecentAuditLogs(count = 20) {
  return queryOnce(COLLECTIONS.AUDIT_LOGS, [], { orderBy: ['createdAt', 'desc'], limit: count });
}

export function getSecurityEvents(count = 20) {
  return queryOnce(COLLECTIONS.SECURITY_EVENTS, [], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function getReports(count = 20) {
  return queryOnce(COLLECTIONS.REPORTS, [], { orderBy: ['createdAt', 'desc'], limit: count });
}

export function getPendingVerifications() {
  return queryOnce(COLLECTIONS.BUSINESSES, [where('isVerified', '==', false)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function recordAuditLog({ actorId, action, target, details = {} }) {
  const { createDoc } = await import('./_base');
  return createDoc(COLLECTIONS.AUDIT_LOGS, {
    actorId,
    action,
    target,
    details,
    createdAt: serverTimestamp(),
  });
}

export async function recordSecurityEvent({ actorId, event, severity = 'info', details = {} }) {
  const { createDoc } = await import('./_base');
  return createDoc(COLLECTIONS.SECURITY_EVENTS, {
    actorId,
    event,
    severity,
    details,
    createdAt: serverTimestamp(),
  });
}

export async function suspendUser(uid) {
  return patchDoc(COLLECTIONS.USERS, uid, {
    accountStatus: 'suspended',
    updatedAt: serverTimestamp(),
  });
}

export async function activateUser(uid) {
  return patchDoc(COLLECTIONS.USERS, uid, {
    accountStatus: 'active',
    updatedAt: serverTimestamp(),
  });
}

export async function verifyBusiness(businessId) {
  return patchDoc(COLLECTIONS.BUSINESSES, businessId, {
    isVerified: true,
    updatedAt: serverTimestamp(),
  });
}

export async function rejectBusiness(businessId) {
  return patchDoc(COLLECTIONS.BUSINESSES, businessId, {
    isVerified: false,
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
}
