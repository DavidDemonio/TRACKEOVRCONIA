import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Server as HttpsServer } from 'https';
import { z } from 'zod';
import { bodyFrameSchema, monitorMessageSchema } from '@trackeovrconia/proto';
import { configStore } from '../config/store.js';
import { FrameNormalizer } from '../services/normalizer.js';
import { sinkBroadcaster } from '../services/broadcaster.js';
import { sessionRecorder } from '../services/session-recorder.js';

const messageSchema = z.object({
  type: z.literal('tracking'),
  payload: bodyFrameSchema,
  metrics: monitorMessageSchema.partial().optional(),
});

type TrackingEnvelope = z.infer<typeof messageSchema>;

type AnyServer = HttpServer | HttpsServer;

export class TrackingServer {
  private readonly wss: WebSocketServer;
  private readonly monitors = new Set<WebSocket>();
  private normalizer = new FrameNormalizer(configStore.getServerConfig());

  constructor(server: AnyServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket, req) => this.handleConnection(socket, req.url ?? ''));
  }

  private handleConnection(socket: WebSocket, url: string): void {
    const mode = url.includes('mode=monitor') ? 'monitor' : 'tracking';
    if (mode === 'monitor') {
      this.monitors.add(socket);
      socket.on('close', () => this.monitors.delete(socket));
      return;
    }
    socket.on('message', (raw) => this.handleMessage(socket, raw));
  }

  private handleMessage(_socket: WebSocket, raw: RawData): void {
    try {
      const json = typeof raw === 'string' ? raw : raw.toString();
      const parsed = messageSchema.parse(JSON.parse(json));
      this.processTracking(parsed);
    } catch (error) {
      console.error('Invalid tracking payload', error);
    }
  }

  private processTracking(message: TrackingEnvelope): void {
    const normalized = this.normalizer.normalize(message.payload);
    sinkBroadcaster.publish(normalized);
    sessionRecorder.record(normalized);
    const targetFps = configStore.getServerConfig().video.targetFps;
    const metrics = {
      cameraFps: message.metrics?.cameraFps ?? targetFps,
      effectiveFps: message.metrics?.effectiveFps ?? targetFps,
      afiMultiplier: message.metrics?.afiMultiplier,
      srEnabled: message.metrics?.srEnabled,
      gpuBackend: message.metrics?.gpuBackend,
      addedLatencyMs: message.metrics?.addedLatencyMs,
    };
    const payload = JSON.stringify({ type: 'monitor', frame: normalized, metrics });
    this.monitors.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  updateConfig(): void {
    this.normalizer.updateConfig(configStore.getServerConfig());
  }
}

export const trackingServerFactory = (server: AnyServer): TrackingServer => new TrackingServer(server);
