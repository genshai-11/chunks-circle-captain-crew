import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
  server: {
    host: '::',
    port: 8080,
    proxy: {
      '/api/transcribeRoundAudio': {
        target: 'https://us-central1-thc-caption-crew-2026.cloudfunctions.net',
        changeOrigin: true,
        rewrite: () => '/transcribeRoundAudio',
      },
      '/api/fetchRouterModels': {
        target: 'https://us-central1-thc-caption-crew-2026.cloudfunctions.net',
        changeOrigin: true,
        rewrite: () => '/fetchRouterModels',
      },
      '/api/testRouterCompletion': {
        target: 'https://us-central1-thc-caption-crew-2026.cloudfunctions.net',
        changeOrigin: true,
        rewrite: () => '/testRouterCompletion',
      },
      '/api/evaluateCaptionCrewMeaning': {
        target: 'https://us-central1-thc-caption-crew-2026.cloudfunctions.net',
        changeOrigin: true,
        rewrite: () => '/evaluateCaptionCrewMeaning',
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});