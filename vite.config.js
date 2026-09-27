import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    // Keep jsPDF out of the initial modulepreload graph — it is only needed
    // when a user downloads a document.
    modulePreload: {
      resolveDependencies(filename, deps) {
        return deps.filter(
          (dep) => !/(^|\/)pdf-|jspdf/i.test(dep) && !dep.includes('pdf-')
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // Firebase SDK — large, shared across authenticated surfaces.
          if (id.includes('node_modules/firebase') || id.includes('@firebase/')) {
            return 'firebase';
          }

          // jsPDF is only pulled in when a document is downloaded.
          if (id.includes('node_modules/jspdf')) {
            return 'pdf';
          }

          // React core + router stay together so we never create a
          // vendor ↔ react circular chunk (which breaks some hosts).
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/react/') ||
            id.endsWith('node_modules/react/index.js')
          ) {
            return 'react';
          }

          // Leave remaining dependencies to Rollup's defaults so small
          // packages can land next to the routes that need them.
          return undefined;
        },
      },
    },
  },
});
