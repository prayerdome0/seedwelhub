// Tiny dependency-free CSV helpers used by the seller bulk-import tools.

// Parses CSV text (RFC-4180-ish: quoted fields, escaped quotes, CRLF) into
// an array of row arrays.
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text || '').replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// Parses CSV text into objects keyed by the header row (headers lower-cased
// and trimmed so "Product Name" and "product name" both work).
export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => String(h).trim());
  const keys = headers.map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const out = rows.slice(1).map((cells) => {
    const obj = {};
    keys.forEach((key, index) => {
      obj[key] = (cells[index] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows: out };
}

function escapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  });
  return lines.join('\n');
}

// Triggers a browser download of CSV text.
export function downloadCsv(filename, csvText) {
  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Product import template ----------

export const PRODUCT_CSV_HEADERS = [
  'name',
  'category',
  'description',
  'price',
  'currency',
  'sku',
  'stock',
  'unit',
  'location',
  'image_url',
  'image_url_2',
  'image_url_3',
];

export const PRODUCT_CSV_SAMPLE_ROWS = [
  {
    name: 'Fresh Maize 50kg Bag',
    category: 'Agriculture',
    description: 'Grade A white maize, freshly harvested, 50kg bag.',
    price: '320',
    currency: 'UGX',
    sku: 'MAIZE-50',
    stock: '120',
    unit: 'bag',
    location: 'Lusaka',
    image_url: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800',
    image_url_2: '',
    image_url_3: '',
  },
  {
    name: 'Roasted Coffee Beans 1kg',
    category: 'Food & Beverage',
    description: 'Single-origin arabica, medium roast, 1kg pack.',
    price: '95',
    currency: 'UGX',
    sku: 'COFFEE-1KG',
    stock: '45',
    unit: 'pack',
    location: 'Kampala',
    image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
    image_url_2: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    image_url_3: '',
  },
  {
    name: 'Cotton T-Shirt (Unisex)',
    category: 'Fashion',
    description: '100% cotton, sizes S-XXL, printed locally.',
    price: '60',
    currency: 'UGX',
    sku: 'TSHIRT-CTN',
    stock: '200',
    unit: 'piece',
    location: 'Ndola',
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    image_url_2: '',
    image_url_3: '',
  },
];

export function productSampleCsv() {
  return toCsv(PRODUCT_CSV_HEADERS, PRODUCT_CSV_SAMPLE_ROWS);
}

// ---------- Inventory import template ----------

export const INVENTORY_CSV_HEADERS = [
  'sku',
  'product_name',
  'quantity',
  'unit',
  'low_stock_alert',
  'cost_price',
  'warehouse',
  'image_url',
];

export const INVENTORY_CSV_SAMPLE_ROWS = [
  {
    sku: 'MAIZE-50',
    product_name: 'Fresh Maize 50kg Bag',
    quantity: '120',
    unit: 'bag',
    low_stock_alert: '20',
    cost_price: '260',
    warehouse: 'Main Store',
    image_url: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800',
  },
  {
    sku: 'COFFEE-1KG',
    product_name: 'Roasted Coffee Beans 1kg',
    quantity: '45',
    unit: 'pack',
    low_stock_alert: '10',
    cost_price: '70',
    warehouse: 'Main Store',
    image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
  },
];

export function inventorySampleCsv() {
  return toCsv(INVENTORY_CSV_HEADERS, INVENTORY_CSV_SAMPLE_ROWS);
}

// Reads a File object as text (Promise wrapper for FileReader).
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file. Please try again.'));
    reader.readAsText(file);
  });
}

// Basic URL sanity check for image links pasted or imported by sellers.
export function isValidImageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(String(url).trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}
