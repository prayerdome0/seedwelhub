const FALLBACK_PROJECT_ID = 'phiko-trading';
const FALLBACK_API_KEY = 'AIzaSyDLqKqyR5yEDTZHAF0uxVf7bo1gPF9z89E';
const COLLECTIONS = { product: 'products', business: 'businesses' };

function decodeValue(value = {}) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue) return decodeFields(value.mapValue.fields || {});
  return '';
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function plainText(value = '') {
  // Firestore strings are text, not HTML. Keep names like "Green <Tea>" intact;
  // the HTML template escapes every value before it is inserted into the page.
  return String(value).replace(/\s+/g, ' ').trim();
}

function money(value, currency = 'ZMW') {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(number);
  } catch {
    return `${number} ${currency}`;
  }
}

function htmlPage({ title, description, image, pageUrl, appUrl, bodyTitle, bodyDescription, detail }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safePageUrl = escapeHtml(pageUrl);
  const safeAppUrl = escapeHtml(appUrl);
  const safeBodyTitle = escapeHtml(bodyTitle);
  const safeBodyDescription = escapeHtml(bodyDescription);
  const safeDetail = escapeHtml(detail);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0f1f33" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <link rel="canonical" href="${safePageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Seedwel Hub" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${safePageUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; padding: 28px 18px; display: grid; place-items: center; font: 16px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #142338; background: linear-gradient(145deg, #f3f8f5, #eef3fa); }
    main { width: min(100%, 620px); overflow: hidden; background: #fff; border: 1px solid #dfe6ec; border-radius: 22px; box-shadow: 0 22px 70px rgba(15,31,51,.13); }
    .brand { padding: 20px 24px; background: #0f1f33; color: #fff; font-weight: 800; letter-spacing: .03em; }
    .brand span { color: #55cf71; }
    .photo { display: block; width: 100%; max-height: 380px; object-fit: cover; background: #eef3f0; }
    .content { padding: 28px; }
    h1 { margin: 0 0 10px; font-size: clamp(24px, 5vw, 34px); line-height: 1.15; }
    p { margin: 0 0 18px; color: #526174; }
    .detail { margin: 0 0 22px; font-size: 20px; font-weight: 800; color: #147038; }
    a { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 20px; border-radius: 999px; background: #15803d; color: #fff; text-decoration: none; font-weight: 750; }
    a:hover { background: #116c33; }
    .foot { margin-top: 20px; font-size: 13px; color: #7a8797; }
  </style>
</head>
<body>
  <main>
    <div class="brand">Seedwel <span>Hub</span></div>
    ${safeImage ? `<img class="photo" src="${safeImage}" alt="" />` : ''}
    <div class="content">
      <h1>${safeBodyTitle}</h1>
      <p>${safeBodyDescription}</p>
      ${safeDetail ? `<div class="detail">${safeDetail}</div>` : ''}
      <a href="${safeAppUrl}">Open on Seedwel Hub</a>
      <div class="foot">Buy · Sell · Manage · Grow</div>
    </div>
  </main>
</body>
</html>`;
}

export default async function handler(request, response) {
  const query = request.query || {};
  const type = String(query.type || '');
  const id = String(query.id || '');
  const collection = COLLECTIONS[type];
  if (!collection || !/^[A-Za-z0-9_-]{1,150}$/.test(id)) {
    response.status(404).send('Share page not found.');
    return;
  }

  const host = String(request.headers['x-forwarded-host'] || request.headers.host || 'seedwelhub.com').split(',')[0].trim();
  const protocol = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const origin = `${protocol}://${host}`;
  const pageUrl = `${origin}/share/${type}/${encodeURIComponent(id)}`;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || FALLBACK_PROJECT_ID;
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || FALLBACK_API_KEY;
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`;

  try {
    const result = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!result.ok) {
      response.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
      response.status(result.status === 404 ? 404 : 502).send('This Seedwel Hub page could not be loaded.');
      return;
    }
    const document = await result.json();
    const data = decodeFields(document.fields || {});
    const isProduct = type === 'product';
    const entityTitle = plainText(data.name || (isProduct ? 'Product listing' : 'Local business'));
    const seller = plainText(data.businessName || data.sellerName || '');
    const description = plainText(data.description || (isProduct
      ? `See ${entityTitle} on Seedwel Hub${seller ? ` from ${seller}` : ''}.`
      : `Visit ${entityTitle} on Seedwel Hub.`)).slice(0, 300);
    const currency = String(data.currency || data.businessCurrency || 'ZMW').toUpperCase();
    const price = isProduct ? money(data.price, currency) : '';
    const title = `${entityTitle} | Seedwel Hub`;
    const image = isProduct
      ? (data.image || (Array.isArray(data.images) ? data.images[0] : '') || '')
      : (data.logo || data.image || '');
    const safeImage = /^https?:\/\//i.test(String(image)) ? String(image) : `${origin}/seedwel-og.png`;
    const appUrl = `${origin}/${isProduct ? 'product' : 'store'}/${encodeURIComponent(id)}`;
    const html = htmlPage({
      title,
      description,
      image: safeImage,
      pageUrl,
      appUrl,
      bodyTitle: entityTitle,
      bodyDescription: description,
      detail: price || [seller, data.category, data.city || data.location].filter(Boolean).join(' · '),
    });

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.status(200).send(html);
  } catch {
    response.setHeader('Cache-Control', 'no-store');
    response.status(502).send('This Seedwel Hub page could not be loaded right now.');
  }
}
