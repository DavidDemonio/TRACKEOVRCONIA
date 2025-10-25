import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import httpProxy from 'http-proxy';

export default defineConfig({
  plugins: [basicSsl(), react(), previewProxy()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {},
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: {},
  },
  worker: {
    format: 'iife',
  },
});

function previewProxy() {
  return {
    name: 'preview-proxy',
    configurePreviewServer(server: import('vite').PreviewServer) {
      const proxy = httpProxy.createProxyServer({ target: 'http://localhost:4000', ws: true, changeOrigin: true });
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (req.url.startsWith('/api')) {
          proxy.web(req, res, undefined, (error: Error & { code?: string }) => {
            console.error('Proxy error', error);
            next(error as unknown as Error);
          });
          return;
        }
        next();
      });
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws')) {
          proxy.ws(req, socket, head);
        }
      });
    },
  } satisfies import('vite').PluginOption;
}
