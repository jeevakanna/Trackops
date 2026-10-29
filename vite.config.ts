import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Allow opening dist/index.html with relative paths
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    watch: {
      ignored: ['**/*.xlsx', '**/*.pdf', '**/dist/**', '**/.git/**', '**/*.bat']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
