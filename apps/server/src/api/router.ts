import { Router } from 'express';
import { z } from 'zod';
import { configStore } from '../config/store.js';
import { sinkBroadcaster } from '../services/broadcaster.js';
import { sessionRecorder } from '../services/session-recorder.js';
import { serverConfigSchema, sinkSchema } from '@trackeovrconia/proto';
import type { TrackingServer } from '../ws/server.js';

const createRouter = (tracking: TrackingServer): Router => {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json(configStore.getServerConfig());
  });

  router.put('/config', (req, res, next) => {
    try {
      const payload = serverConfigSchema.partial().parse(req.body);
      configStore
        .updateServerConfig(payload)
        .then((config) => {
          sinkBroadcaster.updateSinks(config.sinks);
          tracking.updateConfig();
          res.json(config);
        })
        .catch(next);
    } catch (error) {
      next(error);
    }
  });

  router.get('/config/video', (_req, res) => {
    res.json(configStore.getServerConfig().video);
  });

  router.put('/config/video', (req, res, next) => {
    const schema = serverConfigSchema.shape.video.partial();
    try {
      const payload = schema.parse(req.body);
      configStore
        .updateServerConfig({ video: { ...configStore.getServerConfig().video, ...payload } })
        .then((config) => {
          tracking.updateConfig();
          res.json(config.video);
        })
        .catch(next);
    } catch (error) {
      next(error);
    }
  });

  router.get('/sinks', (_req, res) => {
    res.json(configStore.listSinks());
  });

  router.post('/sinks', (req, res, next) => {
    try {
      const payload = sinkSchema.parse(req.body);
      const sinks = [...configStore.listSinks(), payload];
      configStore
        .setSinks(sinks)
        .then((updated) => {
          sinkBroadcaster.updateSinks(updated);
          res.status(201).json(payload);
        })
        .catch(next);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/sinks/:id', (req, res, next) => {
    const { id } = req.params;
    const sinks = configStore.listSinks().filter((sink) => sink.id !== id);
    configStore
      .setSinks(sinks)
      .then((updated) => {
        sinkBroadcaster.updateSinks(updated);
        res.status(204).send();
      })
      .catch(next);
  });

  router.post('/sessions', async (req, res, next) => {
    try {
      const actionSchema = z.object({ action: z.enum(['start', 'stop']) });
      const { action } = actionSchema.parse(req.body);
      if (action === 'start') {
        const sessionId = await sessionRecorder.start();
        res.json({ sessionId });
      } else {
        sessionRecorder.stop();
        res.status(204).send();
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
};

export default createRouter;
