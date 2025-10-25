import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../state/store';
import type { BodyFrame } from '@trackeovrconia/proto';

interface WorkerMetrics {
  cameraFps: number;
  effectiveFps: number;
  afiMultiplier?: number;
  srEnabled?: boolean;
  gpuBackend?: string;
  addedLatencyMs?: number;
}

interface WorkerPoseMessage {
  type: 'pose';
  frame: BodyFrame;
  metrics: WorkerMetrics;
}

interface WorkerMetricsMessage {
  type: 'metrics';
  metrics: WorkerMetrics;
}

interface WorkerErrorMessage {
  type: 'error';
  message: string;
}

type WorkerMessages = WorkerPoseMessage | WorkerMetricsMessage | WorkerErrorMessage;

export const useTracking = (modelAssetPath: string) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker>();
  const wsRef = useRef<WebSocket>();
  const lastTimestamp = useRef<number>(0);
  const frameHandleRef = useRef<number>();
  const fallbackHandleRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const trackingActiveRef = useRef(false);
  const setMetrics = useAppStore((state) => state.setMetrics);
  const setFrame = useAppStore((state) => state.setFrame);
  const smoothing = useAppStore((state) => state.smoothingStrength);
  const videoConfig = useAppStore((state) => state.videoConfig);
  const selectedCamera = useAppStore((state) => state.selectedCamera);
  const trackingActive = useAppStore((state) => state.trackingActive);
  const setTrackingActive = useAppStore((state) => state.setTrackingActive);
  const setTrackingError = useAppStore((state) => state.setTrackingError);
  const trackingError = useAppStore((state) => state.trackingError);

  const secureContext = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.isSecureContext) return true;
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }, []);

  const wsUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const configured = import.meta.env.VITE_WS_URL as string | undefined;
    if (configured) return configured;
    const { protocol, hostname, port } = window.location;
    if (protocol === 'https:') {
      return `wss://${hostname}${port ? `:${port}` : ''}/ws`;
    }
    const fallbackPort = import.meta.env.VITE_SERVER_PORT || '4000';
    return `ws://${hostname}:${fallbackPort}/ws`;
  }, []);

  const ensureSocket = useCallback(() => {
    if (typeof WebSocket === 'undefined') return;
    if (!wsUrl) return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;
    try {
      wsRef.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('No se pudo crear el WebSocket', error);
      setTrackingError('No se pudo conectar con el servidor de tracking.');
      return;
    }
    wsRef.current.addEventListener('open', () => {
      setTrackingError(undefined);
    });
    wsRef.current.addEventListener('error', () => {
      setTrackingError('No se pudo conectar con el servidor de tracking.');
    });
    wsRef.current.addEventListener('close', () => {
      if (trackingActiveRef.current) {
        window.setTimeout(() => ensureSocket(), 1000);
      }
    });
  }, [setTrackingError, wsUrl]);

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

  const initWorker = useCallback(() => {
    if (workerRef.current) return;
    if (!overlayRef.current) return;
    if (typeof Worker === 'undefined') return;
    workerRef.current = new Worker(new URL('../workers/trackingWorker.ts', import.meta.url));
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
        return;
      }
      if (event.data.type === 'metrics') {
        setMetrics(event.data.metrics);
        return;
      }
      if (event.data.type === 'error') {
        setTrackingError(event.data.message);
      }
    };
  }, [modelAssetPath, videoConfig, setMetrics, setFrame, sendFrame, setTrackingError]);

  const captureFrame = useCallback(
    async (_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => {
      const video = videoRef.current;
      if (!video || !workerRef.current || !trackingActiveRef.current) {
        return false;
      }
      try {
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
      } catch (error) {
        console.error('Frame capture error', error);
        return false;
      }
      return trackingActiveRef.current;
    },
    [videoConfig.targetFps],
  );

  const scheduleNextFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if ('requestVideoFrameCallback' in video) {
      frameHandleRef.current = video.requestVideoFrameCallback(async (now, metadata) => {
        const proceed = await captureFrame(now, metadata);
        if (proceed) {
          scheduleNextFrame();
        }
      });
      return;
    }
    const fallbackVideo = video as HTMLVideoElement;
    fallbackHandleRef.current = window.setTimeout(async () => {
      const metadata = {
        mediaTime: fallbackVideo.currentTime,
        presentedFrames: 0,
      } as VideoFrameCallbackMetadata;
      const proceed = await captureFrame(performance.now(), metadata);
      if (proceed) {
        scheduleNextFrame();
      }
    }, 1000 / Math.max(1, videoConfig.targetFps));
  }, [captureFrame, videoConfig.targetFps]);

  const cancelFrameLoop = useCallback(() => {
    if (frameHandleRef.current && videoRef.current?.cancelVideoFrameCallback) {
      videoRef.current.cancelVideoFrameCallback(frameHandleRef.current);
    }
    frameHandleRef.current = undefined;
    if (fallbackHandleRef.current) {
      clearTimeout(fallbackHandleRef.current);
      fallbackHandleRef.current = undefined;
    }
  }, []);

  const stopStream = useCallback(() => {
    cancelFrameLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    trackingActiveRef.current = false;
    lastTimestamp.current = 0;
    setTrackingActive(false);
  }, [cancelFrameLoop, setTrackingActive]);

  const openStream = useCallback(async () => {
    const video = videoRef.current;
    if (!video) throw new Error('Video element no disponible');
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia no está soportado en este navegador');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: selectedCamera || undefined } });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = stream;
    video.srcObject = stream;
    await video.play();
  }, [selectedCamera]);

  const startTracking = useCallback(async () => {
    if (trackingActiveRef.current) return;
    if (!secureContext) {
      setTrackingError('La cámara requiere ejecutar la aplicación bajo HTTPS o localhost.');
      return;
    }
    try {
      setTrackingError(undefined);
      initWorker();
      ensureSocket();
      await openStream();
      trackingActiveRef.current = true;
      setTrackingActive(true);
      scheduleNextFrame();
    } catch (error) {
      console.error('No se pudo iniciar el tracking', error);
      setTrackingError((error as Error).message);
      stopStream();
    }
  }, [ensureSocket, initWorker, openStream, scheduleNextFrame, secureContext, setTrackingActive, setTrackingError, stopStream]);

  const stopTracking = useCallback(() => {
    stopStream();
  }, [stopStream]);

  useEffect(() => {
    ensureSocket();
  }, [ensureSocket]);

  useEffect(() => {
    if (!trackingActiveRef.current) return;
    cancelFrameLoop();
    openStream()
      .then(() => {
        scheduleNextFrame();
      })
      .catch((error) => {
        console.error('Cambio de cámara fallido', error);
        setTrackingError((error as Error).message);
      });
  }, [cancelFrameLoop, openStream, scheduleNextFrame, setTrackingError]);

  const overlayCallback = useCallback(
    (node: HTMLCanvasElement | null) => {
      overlayRef.current = node;
      if (node) {
        initWorker();
      }
    },
    [initWorker],
  );

  useEffect(() => {
    return () => {
      stopStream();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = undefined;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [stopStream]);

  return {
    videoRef,
    overlayRef: overlayCallback,
    startTracking,
    stopTracking,
    trackingActive,
    trackingError,
    secureContext,
  };
};
