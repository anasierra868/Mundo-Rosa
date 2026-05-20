import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    preserveSymlinks: true
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://137-184-198-49.sslip.io',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 0, // Desactivar timeout para conexiones largas (SSE)
        proxyTimeout: 0,
        rewrite: (path) => path,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // v27.0: Prevent proxy from buffering SSE
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
          });
        }
      }
    }
  }
})
