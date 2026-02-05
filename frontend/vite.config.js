import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for GitHub Pages deployment
  // Change 'your-repo-name' to your actual repository name
  base: process.env.NODE_ENV === 'production' ? '/your-repo-name/' : '/',

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
