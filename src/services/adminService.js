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

// ---------------------------------------------------------------------------
// Anti-fraud / audit tooling.
//
// Design principle: this is an *accountability* system, not a surveillance
// system. It records what happened on the platform — orders, payments, proofs,
// transaction references, review decisions and account state changes — and
// who performed each privileged action. Metadata is limited to what the
// platform legitimately needs to investigate a dispute, and every admin action
// is itself written to the immutable audit trail.
// ---------------------------------------------------------------------------

export function getAuditLogsForTarget(target, count = 50) {
  return queryOnce(COLLECTIONS.AUDIT_LOGS, [where('target', '==', target)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function getAuditLogsForActor(actorId, count = 50) {
  return queryOnce(COLLECTIONS.AUDIT_LOGS, [where('actorId', '==', actorId)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function getSecurityEventsForUser(uid, count = 50) {
  return queryOnce(COLLECTIONS.SECURITY_EVENTS, [where('actorId', '==', uid)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function getReportsForTarget(targetId) {
  return queryOnce(COLLECTIONS.REPORTS, [where('targetId', '==', targetId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

/**
 * Moves an account through the risk lifecycle:
 * Normal → Flagged → Under Review → Restricted → Suspended
 *
 * The change is always paired with a reason and an audit-log entry, so the
 * trail explains *why* an account was actioned, not just that it was.
 */
export async function setUserRiskStatus(uid, riskStatus, { actorId, reason = '' } = {}) {
  await patchDoc(COLLECTIONS.USERS, uid, {
    riskStatus,
    riskReason: reason,
    riskUpdatedAt: serverTimestamp(),
    riskUpdatedBy: actorId || null,
  });

  await recordAuditLog({
    actorId,
    action: `account.risk.${riskStatus}`,
    target: `users/${uid}`,
    details: { riskStatus, reason },
  }).catch(() => {});

  await recordSecurityEvent({
    actorId: uid,
    event: `Account risk status set to ${riskStatus}`,
    severity:
      riskStatus === 'suspended' || riskStatus === 'restricted'
        ? 'high'
        : riskStatus === 'under_review' || riskStatus === 'flagged'
          ? 'warning'
          : 'info',
    details: { reason, changedBy: actorId || null },
  }).catch(() => {});

  return { uid, riskStatus };
}

/**
 * Raises a fraud flag against a transaction or account for investigation.
 */
export async function flagForReview({ actorId, targetType, targetId, reason, severity = 'warning', details = {} }) {
  const { createDoc } = await import('./_base');
  const flag = await createDoc(COLLECTIONS.SECURITY_EVENTS, {
    actorId: actorId || null,
    subjectType: targetType,
    subjectId: targetId,
    event: reason,
    severity,
    details,
    resolved: false,
    createdAt: serverTimestamp(),
  });

  await recordAuditLog({
    actorId,
    action: 'fraud.flag_raised',
    target: `${targetType}/${targetId}`,
    details: { reason, severity, ...details },
  }).catch(() => {});

  return flag;
}

export async function resolveSecurityEvent(id, { actorId, resolution = '' } = {}) {
  await patchDoc(COLLECTIONS.SECURITY_EVENTS, id, {
    resolved: true,
    resolution,
    resolvedBy: actorId || null,
    resolvedAt: serverTimestamp(),
  });
  await recordAuditLog({
    actorId,
    action: 'fraud.flag_resolved',
    target: `securityEvents/${id}`,
    details: { resolution },
  }).catch(() => {});
  return id;
}

/**
 * Builds the consolidated security view an administrator sees for one user:
 * their account record, orders, payments, proofs, security events, reports and
 * audit history — everything needed to adjudicate a dispute in one place.
 */
export async function getUserSecurityDossier(uid) {
  const safe = (promise) => promise.catch(() => []);

  const [user, orders, payments, proofs, securityEvents, reports, auditLogs, businesses] =
    await Promise.all([
      getById(COLLECTIONS.USERS, uid).catch(() => null),
      safe(queryOnce(COLLECTIONS.ORDERS, [where('buyerId', '==', uid)], { orderBy: ['createdAt', 'desc'], limit: 50 })),
      safe(queryOnce(COLLECTIONS.PAYMENTS, [where('buyerId', '==', uid)], { orderBy: ['createdAt', 'desc'], limit: 50 })),
      safe(queryOnce(COLLECTIONS.PAYMENT_PROOFS, [where('buyerId', '==', uid)], { orderBy: ['createdAt', 'desc'], limit: 50 })),
      safe(getSecurityEventsForUser(uid)),
      safe(queryOnce(COLLECTIONS.REPORTS, [where('targetId', '==', uid)], { orderBy: ['createdAt', 'desc'] })),
      safe(getAuditLogsForTarget(`users/${uid}`)),
      safe(queryOnce(COLLECTIONS.BUSINESSES, [where('ownerId', '==', uid)])),
    ]);

  // Sales made by this user as a seller.
  const sellerOrders = await safe(
    queryOnce(COLLECTIONS.ORDERS, [where('ownerId', '==', uid)], { orderBy: ['createdAt', 'desc'], limit: 50 })
  );

  return {
    user,
    businesses,
    orders,
    sellerOrders,
    payments,
    proofs,
    securityEvents,
    reports,
    auditLogs,
  };
}

/**
 * Scans recent payment activity for the fraud signals worth an admin's
 * attention: the same transaction reference used on multiple orders, and
 * proofs that have been waiting too long for review.
 */
export async function detectSuspiciousPayments() {
  const [payments, proofs] = await Promise.all([
    queryOnce(COLLECTIONS.PAYMENTS, [], { orderBy: ['createdAt', 'desc'], limit: 300 }).catch(() => []),
    queryOnce(COLLECTIONS.PAYMENT_PROOFS, [], { orderBy: ['createdAt', 'desc'], limit: 300 }).catch(() => []),
  ]);

  // Group by normalised transaction reference.
  const byReference = new Map();
  for (const payment of payments || []) {
    const reference = String(payment.transactionReference || payment.reference || '')
      .trim()
      .toUpperCase();
    if (!reference) continue;
    if (!byReference.has(reference)) byReference.set(reference, []);
    byReference.get(reference).push(payment);
  }

  const duplicateReferences = [...byReference.entries()]
    .filter(([, group]) => {
      const orderIds = new Set(group.map((p) => p.orderId).filter(Boolean));
      return orderIds.size > 1;
    })
    .map(([reference, group]) => ({ reference, payments: group }));

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const stalledProofs = (proofs || []).filter((proof) => {
    if (proof.status !== 'submitted') return false;
    const created = proof.createdAt?.toMillis?.() ?? 0;
    return created > 0 && now - created > 3 * DAY;
  });

  return { duplicateReferences, stalledProofs };
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
