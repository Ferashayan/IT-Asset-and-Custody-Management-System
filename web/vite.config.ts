import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // keep build files out of /assets, which is an app route
  build: { assetsDir: 'static' },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // During local development the API runs on :4000
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
    },
  },
});
