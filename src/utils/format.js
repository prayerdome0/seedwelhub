// Formatting helpers.

export function formatCurrency(amount, currency = 'UGX') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return `— ${currency}`;
  }
  const value = Number(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-US').format(Number(value));
}

export function formatDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  const intervals = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  if (seconds < 60) return 'just now';

  for (const [unit, size] of intervals) {
    const count = Math.floor(seconds / size);
    if (count >= 1) {
      return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function truncate(text, maxLength = 120) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

// Firestore timestamps, dates and serialized timestamps can all appear in
// client data. Keeping the conversion here makes client-side sorting reliable
// when a query intentionally avoids a composite index.
export function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') {
    return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortByTimestamp(items, field, direction = 'desc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...(items || [])].sort((a, b) => (
    (timestampMillis(a?.[field]) - timestampMillis(b?.[field])) * multiplier
  ));
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clampNumber(value, min, max) {
  const n = Number(value) || 0;
  return Math.min(max, Math.max(min, n));
}

// Friendly status styling key.
export function statusTone(status = '') {
  const s = String(status).toLowerCase();
  if (['delivered', 'confirmed', 'active', 'paid', 'verified', 'completed'].includes(s)) {
    return 'success';
  }
  if (['pending', 'processing', 'placed', 'submitted', 'ready'].includes(s)) {
    return 'info';
  }
  if (['rejected', 'suspended', 'banned', 'cancelled', 'failed', 'disputed'].includes(s)) {
    return 'danger';
  }
  return 'neutral';
}
