import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages deployment
  base: process.env.NODE_ENV === 'production' ? '/fun-game/' : '/',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },

  server: {
    port: 5173,
    open: true
  },

  resolve: {
    alias: {
      '@': '/src',
      '@shared': '/../shared'
    }
  }
});
