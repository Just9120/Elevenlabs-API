import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['icons/icon.svg', 'manifest.webmanifest'],
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
});
