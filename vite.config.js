import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Utvecklingsservern proxar API och WebSocket till Express-backenden.
export default defineConfig({
  plugins: [react()],
  publicDir: 'client/public',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
