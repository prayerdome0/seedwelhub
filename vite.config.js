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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/react')) return 'react';
          // jsPDF is only pulled in when a document is downloaded, so it is
          // kept out of the shared vendor chunk to protect first paint.
          if (id.includes('node_modules/jspdf')) return 'pdf';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
