// Routing, deployment-rewrite and branded-404 verification.
//
// The raw host "404: NOT_FOUND" page appears when the static host serves an
// unknown path directly instead of handing it to the SPA. These checks lock in
// the rewrite configuration and the branded fallback so that regression cannot
// silently return.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('\nDEPLOYMENT REWRITES (no more raw 404: NOT_FOUND)');

const vercel = JSON.parse(read('vercel.json'));

check('vercel.json rewrites every non-API path to index.html', () => {
  const rule = (vercel.rewrites || []).find((r) => r.destination === '/index.html');
  assert.ok(rule, 'no SPA rewrite rule found');
  assert.match(rule.source, /\(\?!api\//, 'rewrite must exclude /api/*');
});

check('build output settings match the Vite build', () => {
  assert.equal(vercel.outputDirectory, 'dist');
  assert.equal(vercel.buildCommand, 'npm run build');
});

check('the FCM service worker is never cached', () => {
  const header = (vercel.headers || []).find((h) => h.source === '/firebase-messaging-sw.js');
  assert.ok(header, 'no cache header for firebase-messaging-sw.js');
  const cache = header.headers.find((h) => h.key === 'Cache-Control');
  assert.match(cache.value, /no-store|no-cache/);
});

check('a _redirects fallback covers non-Vercel static hosts', () => {
  assert.match(read('public/_redirects'), /^\/\*\s+\/index\.html\s+200/m);
});

check('404.html hands unknown deep links back to the SPA', () => {
  const html = read('public/404.html');
  assert.match(html, /seedwel:redirect/);
  assert.match(html, /location\.replace\('\/'\)/);
});

check('main.jsx replays the stored deep link into the router', () => {
  const main = read('src/main.jsx');
  assert.match(main, /seedwel:redirect/);
  assert.match(main, /history\.replaceState/);
  // Guard against open-redirect style values from storage.
  assert.match(main, /startsWith\('\/'\)/);
  assert.match(main, /!target\.startsWith\('\/\/'\)/);
});

console.log('\nCLIENT ROUTES SURVIVE A DIRECT LOAD');

const app = read('src/App.jsx');
const ROUTES = [
  '/marketplace',
  '/account',
  '/messages',
  '/messages/group/:id',
  '/seller',
  '/orders',
  '/invoices',
  '/quotations',
  '/settings',
  '/notifications',
  '/groups',
  '/group/:id',
];

for (const route of ROUTES) {
  check(`route ${route} is declared`, () => {
    assert.ok(app.includes(`path="${route}"`), `missing route ${route}`);
  });
}

check('/seller/dashboard redirects into the seller dashboard', () => {
  assert.match(app, /path="\/seller\/dashboard"[\s\S]{0,80}Navigate to="\/seller"/);
});

check('/messages/group/:id is matched before /messages/:id', () => {
  const groupIdx = app.indexOf('path="/messages/group/:id"');
  const convoIdx = app.indexOf('path="/messages/:id"');
  assert.ok(groupIdx > -1 && convoIdx > -1);
  assert.ok(groupIdx < convoIdx, 'the group alias must be declared first');
});

check('a catch-all route renders the branded 404', () => {
  assert.match(app, /path="\*"[\s\S]{0,60}NotFoundPage/);
});

console.log('\nBRANDED 404 PAGE');

const notFound = read('src/pages/NotFoundPage.jsx');

check('shows the Seedwel Hub logo', () => {
  assert.match(notFound, /WATERMARK_LOGO/);
  assert.match(notFound, /alt="Seedwel Hub"/);
});
check('shows an illustration', () => assert.match(notFound, /<svg/));
check('shows 404 and "Page Not Found"', () => {
  assert.match(notFound, />404</);
  assert.match(notFound, /Page Not Found/);
});
check('uses the friendly explanation copy', () => {
  assert.match(notFound, /couldn&apos;t find the page you&apos;re looking for/);
  assert.match(notFound, /moved, deleted, or the link may be incorrect/);
});
check('offers Go Home, Go Back and Browse Marketplace', () => {
  assert.match(notFound, /to="\/"[\s\S]{0,60}Go Home/);
  assert.match(notFound, /Go Back/);
  assert.match(notFound, /to="\/marketplace"[\s\S]{0,60}Browse Marketplace/);
});
check('never exposes a raw host error code to the user', () => {
  // Comments may mention the raw code they replace; the rendered markup may not.
  const code = notFound.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/NOT_FOUND/.test(code), 'raw NOT_FOUND text is rendered');
  assert.ok(!/Code:\s*NOT_FOUND/.test(code));
});

console.log('\nNO CLIPPING / NO HORIZONTAL OVERFLOW');

const css = read('src/index.css');
check('404 layout wraps its actions instead of overflowing', () => {
  const block = css.slice(css.indexOf('.notfound__actions'));
  assert.match(block, /flex-wrap:\s*wrap/);
});
check('404 illustration is capped to the viewport width', () => {
  assert.match(css, /\.notfound__art\s*\{[^}]*width:\s*min\(220px,\s*70vw\)/);
});
check('long unknown paths wrap rather than overflow', () => {
  assert.match(css, /\.notfound__path\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

console.log('\nGRACEFUL ERROR STATE (never a blank page or raw error)');

const boundary = read('src/components/ErrorBoundary.jsx');
check('error boundary offers Try Again and Go Home', () => {
  assert.match(boundary, /Try Again/);
  assert.match(boundary, /Go Home/);
});
check('error boundary hides technical detail from users', () => {
  assert.ok(!/error\.stack|componentStack/.test(boundary.split('render()')[1] || ''));
});

console.log(`\n${passed} assertions passed.`);
