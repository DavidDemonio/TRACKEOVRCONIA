import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import httpProxy from 'http-proxy';
import { fileURLToPath } from 'url';
import { dirname, resolve as resolvePath } from 'path';

const rootDir = dirname(fileURLToPath(import.meta.url));
const alias = {
  '@trackeovrconia/proto': resolvePath(rootDir, 'src/types/proto.ts'),
  '@trackeovrconia/utils': resolvePath(rootDir, 'src/types/utils.ts'),
  '@trackeovrconia/video-afi': resolvePath(rootDir, 'src/types/video-afi.ts'),
};

export default defineConfig({
  plugins: [basicSsl(), react(), previewProxy()],
  resolve: {
    alias,
  },
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
      const targetHost = process.env.SERVER_HOST ?? 'localhost';
      const targetPort = Number(process.env.SERVER_PORT ?? '4000');
      const proxy = httpProxy.createProxyServer({ changeOrigin: true, secure: false });
      const targetHttp = `http://${targetHost}:${targetPort}`;
      const targetWs = `ws://${targetHost}:${targetPort}`;
      proxy.on('error', (error: NodeJS.ErrnoException) => {
        console.error('Proxy error', error);
      });
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        if (req.url.startsWith('/api')) {
          proxy.web(req, res, { target: targetHttp }, (error: Error & { code?: string }) => {
            console.error('Proxy error', error);
            next(error as unknown as Error);
          });
          return;
        }
        next();
      });
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (!req.url?.startsWith('/ws')) {
          return;
        }
        proxy.ws(req, socket, head, { target: `${targetWs}${req.url}` });
      });
    },
  } satisfies import('vite').PluginOption;
}
