import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy API + admin to the Django backend so the SPA is same-origin with it in
// dev (session cookies + CSRF work without cross-origin credential handling).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/admin': { target: 'http://localhost:8000', changeOrigin: true },
      '/static': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
