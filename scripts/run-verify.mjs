// Verification runner.
//
// Everything executes through Vite so the app's own module resolution applies.
// The workflow suite additionally swaps the Firestore SDK for an in-memory mock
// (scripts/firestore-mock.mjs), letting the real service layer run end-to-end
// without a live Firebase project.
//
//   npm run verify
import { createServer } from 'vite';
import path from 'node:path';

const root = process.cwd();

// Suites that run against the real modules.
const UNIT_SUITES = [
  '/scripts/verify-documents.mjs',
  '/scripts/verify-navigation.mjs',
  '/scripts/verify-security.mjs',
  '/scripts/verify-render.mjs',
];

// Suites that need the Firestore mock swapped in.
const FLOW_SUITES = ['/scripts/verify-flows.mjs'];

const banner = (name) => {
  const label = name.replace('/scripts/verify-', '').replace('.mjs', '').toUpperCase();
  console.log(`\n${'═'.repeat(58)}\n${label}\n${'═'.repeat(58)}`);
};

async function runWith(suites, config) {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
    ...config,
  });
  try {
    for (const suite of suites) {
      banner(suite);
      await server.ssrLoadModule(suite);
    }
  } finally {
    await server.close();
  }
}

await runWith(UNIT_SUITES, {});
await runWith(FLOW_SUITES, {
  resolve: {
    alias: [{
      find: /^.*\/firebase\/firestore(\.js)?$/,
      replacement: path.resolve(root, 'scripts/firestore-mock.mjs'),
    }],
  },
  ssr: { noExternal: true },
});

if (process.exitCode) console.error('\n✗ Some checks failed.\n');
else console.log('\n✓ All verification suites passed.\n');
