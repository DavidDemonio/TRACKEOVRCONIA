import http from 'http';
import https from 'https';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { collectDefaultMetrics, Registry } from 'prom-client';
import path from 'path';
import fs from 'fs';
import createRouter from './api/router.js';
import { configStore } from './config/store.js';
import { sinkBroadcaster } from './services/broadcaster.js';
import { trackingServerFactory } from './ws/server.js';
import { resolveCertificate } from './utils/certificates.js';

dotenv.config();

const logger = pino({ name: 'server' });
const registry = new Registry();
collectDefaultMetrics({ register: registry });

async function bootstrap(): Promise<void> {
  await configStore.load();
  sinkBroadcaster.updateSinks(configStore.listSinks());

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(pinoHttp({ logger }));

  const httpsEnabled = process.env.DISABLE_HTTPS === 'true' ? false : true;
  let server: http.Server | https.Server;
  let protocol: 'http' | 'https' = 'http';
  if (httpsEnabled) {
    try {
      const pair = await resolveCertificate(logger);
      server = https.createServer({ key: pair.key, cert: pair.cert }, app);
      protocol = 'https';
    } catch (error) {
      logger.error({ error }, 'Falling back to HTTP server because HTTPS setup failed');
      server = http.createServer(app);
    }
  } else {
    server = http.createServer(app);
  }
  const ws = trackingServerFactory(server);
  app.use('/api', createRouter(ws));
  const staticDir = path.resolve(process.cwd(), 'apps/web/dist');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  const port = Number(process.env.PORT ?? 4000);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(400).json({ error: err.message });
  });

  server.listen(port, () => {
    logger.info({ port, protocol }, 'Server listening');
    ws.updateConfig();
  });
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Failed to bootstrap server');
  process.exit(1);
});
