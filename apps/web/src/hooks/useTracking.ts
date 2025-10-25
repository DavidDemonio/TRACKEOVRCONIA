import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../state/store';
import type { BodyFrame } from '@trackeovrconia/proto';

interface WorkerPoseMessage {
  type: 'pose';
  frame: BodyFrame;
  metrics: {
    cameraFps: number;
    effectiveFps: number;
    afiMultiplier?: number;
    srEnabled?: boolean;
    gpuBackend?: string;
    addedLatencyMs?: number;
  };
}

type WorkerMessages = WorkerPoseMessage;

export const useTracking = (modelAssetPath: string) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker>();
  const wsRef = useRef<WebSocket>();
  const lastTimestamp = useRef<number>(0);
  const setMetrics = useAppStore((state) => state.setMetrics);
  const setFrame = useAppStore((state) => state.setFrame);
  const smoothing = useAppStore((state) => state.smoothingStrength);
  const videoConfig = useAppStore((state) => state.videoConfig);
  const selectedCamera = useAppStore((state) => state.selectedCamera);

  const initWorker = useCallback(() => {
    if (workerRef.current) return;
    if (!overlayRef.current) return;
    if (typeof Worker === 'undefined') return;
    workerRef.current = new Worker(new URL('../workers/trackingWorker.ts', import.meta.url), {
      type: 'module',
    });
    const offscreen = overlayRef.current?.transferControlToOffscreen?.();
    const message = {
      type: 'init' as const,
      modelAssetPath,
      video: videoConfig,
      canvas: offscreen,
    };
    if (offscreen) {
      workerRef.current.postMessage(message, [offscreen]);
    } else {
      workerRef.current.postMessage(message);
    }
    workerRef.current.onmessage = (event: MessageEvent<WorkerMessages>) => {
      if (event.data.type === 'pose') {
        const { frame, metrics } = event.data;
        setMetrics(metrics);
        setFrame(frame);
        sendFrame(frame, metrics);
      }
    };
  }, [modelAssetPath, videoConfig, setMetrics, setFrame]);

  const ensureSocket = useCallback(() => {
    if (typeof WebSocket === 'undefined') return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    wsRef.current = new WebSocket(`${window.location.origin.replace('http', 'ws')}/ws`);
  }, []);

  const sendFrame = useCallback(
    (frame: BodyFrame, metrics: WorkerPoseMessage['metrics']) => {
      ensureSocket();
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const payload = {
        type: 'tracking',
        payload: frame,
        metrics,
        smoothing,
      };
      wsRef.current.send(JSON.stringify(payload));
    },
    [ensureSocket, smoothing],
  );

  const captureFrame = useCallback(
    async (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
      const video = videoRef.current;
      if (!video || !workerRef.current) return;
      const bitmap = await createImageBitmap(video);
      const timestamp = metadata.mediaTime * 1000;
      const dt = timestamp - lastTimestamp.current;
      const cameraFps = dt > 0 ? 1000 / dt : videoConfig.targetFps;
      lastTimestamp.current = timestamp;
      workerRef.current.postMessage(
        {
          type: 'frame',
          frame: bitmap,
          timestamp,
          cameraFps,
        },
        [bitmap],
      );
      video.requestVideoFrameCallback(captureFrame);
    },
    [videoConfig.targetFps],
  );

  useEffect(() => {
    ensureSocket();
    initWorker();
  }, [ensureSocket, initWorker]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: selectedCamera || undefined } })
      .then((stream) => {
        video.srcObject = stream;
        return video.play();
      })
      .then(() => {
        video.requestVideoFrameCallback(captureFrame);
      })
      .catch((error) => {
        console.error('Camera error', error);
      });
  }, [captureFrame, selectedCamera]);

  const overlayCallback = useCallback(
    (node: HTMLCanvasElement | null) => {
      overlayRef.current = node;
      if (node) {
        initWorker();
      }
    },
    [initWorker],
  );

  return { videoRef, overlayRef: overlayCallback };
};
