import { defineConfig } from 'vite';

// Relative base so the build works from any folder: a static host, an artifact, or Capacitor's iOS webview.
export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
