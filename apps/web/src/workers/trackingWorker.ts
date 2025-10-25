import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { AdaptiveFrameInterpolator } from '@trackeovrconia/video-afi';
import { mapLandmarksToFrame } from '../utils/poseMapping';

interface InitMessage {
  type: 'init';
  canvas?: OffscreenCanvas;
  modelAssetPath: string;
  video: {
    targetFps: number;
    aiSmooth: 'auto' | 'on' | 'off';
    sr: 'off' | 'auto';
  };
}

interface FrameMessage {
  type: 'frame';
  frame: ImageBitmap;
  timestamp: number;
  cameraFps: number;
}

interface MetricsPayload {
  cameraFps: number;
  effectiveFps: number;
  afiMultiplier?: number;
  srEnabled?: boolean;
  gpuBackend?: string;
  addedLatencyMs?: number;
}

type WorkerMessage = InitMessage | FrameMessage;

type WorkerResponse =
  | { type: 'pose'; frame: ReturnType<typeof mapLandmarksToFrame>; metrics: MetricsPayload }
  | { type: 'metrics'; metrics: MetricsPayload }
  | { type: 'error'; message: string };

declare const self: any;

let landmarker: PoseLandmarker | undefined;
let interpolator: AdaptiveFrameInterpolator | undefined;
let previewCtx: OffscreenCanvasRenderingContext2D | null = null;
let modelBasePath: string | undefined;

const DEFAULT_VISION_ASSETS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.7/wasm';
const DEFAULT_POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

const sanitizeBasePath = (base?: string): string | undefined => {
  if (!base) return undefined;
  if (base.endsWith('/')) return base.slice(0, -1);
  return base;
};

const resolveMetrics = (overrides: Partial<MetricsPayload>): MetricsPayload => ({
  cameraFps: 0,
  effectiveFps: 0,
  srEnabled: false,
  gpuBackend: 'cpu',
  addedLatencyMs: 0,
  ...overrides,
});

const renderSkeleton = (landmarks: any[], width: number, height: number) => {
  if (!previewCtx) return;
  if (previewCtx.canvas.width !== width || previewCtx.canvas.height !== height) {
    previewCtx.canvas.width = width;
    previewCtx.canvas.height = height;
  }
  previewCtx.clearRect(0, 0, width, height);
  const drawingUtils = new DrawingUtils(previewCtx);
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: '#4ade80',
    lineWidth: 3,
  });
  drawingUtils.drawLandmarks(landmarks, { color: '#f97316', radius: 4 });
};

const ensureLandmarker = async () => {
  if (landmarker) return;
  const base = sanitizeBasePath(modelBasePath);
  const wasmSource = base ?? DEFAULT_VISION_ASSETS;
  try {
    const fileset = await FilesetResolver.forVisionTasks(wasmSource);
    const model = base ? `${base}/pose_landmarker_full.task` : DEFAULT_POSE_MODEL;
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: model,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.4,
    });
  } catch (error) {
    if (base) {
      console.warn('Fallo al cargar recursos locales de MediaPipe, usando CDN por defecto', error);
      const fileset = await FilesetResolver.forVisionTasks(DEFAULT_VISION_ASSETS);
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: DEFAULT_POSE_MODEL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
      });
      return;
    }
    throw error;
  }
};

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === 'init') {
    const { canvas, modelAssetPath, video } = event.data;
    previewCtx = canvas ? canvas.getContext('2d') : null;
    modelBasePath = sanitizeBasePath(modelAssetPath);
    try {
      await ensureLandmarker();
    } catch (error) {
      console.error('No se pudo inicializar MediaPipe Pose', error);
      self.postMessage({ type: 'error', message: 'No se pudo inicializar el modelo de pose.' } satisfies WorkerResponse);
      return;
    }
    if (video.aiSmooth !== 'off' && modelBasePath && typeof VideoFrame !== 'undefined') {
      interpolator = new AdaptiveFrameInterpolator({
        modelUrl: `${modelBasePath}/rife-lite.onnx`,
        targetFps: video.targetFps,
        maxMultiplier: video.aiSmooth === 'on' ? 3 : 2,
      });
    } else {
      interpolator = undefined;
    }
    return;
  }

  if (!landmarker) {
    return;
  }

  const { frame, timestamp, cameraFps } = event.data;
  const baseMetrics = resolveMetrics({ cameraFps, effectiveFps: cameraFps });
  let metrics = baseMetrics;
  try {
    const supportsVideoFrame = typeof VideoFrame !== 'undefined';
    const videoFrame = supportsVideoFrame ? new VideoFrame(frame, { timestamp }) : frame;
    let inferenceFrame: typeof videoFrame = videoFrame;
    if (interpolator && supportsVideoFrame && videoFrame instanceof VideoFrame) {
      try {
        const result = await interpolator.interpolate({ prev: videoFrame, next: videoFrame }, cameraFps);
        metrics = resolveMetrics({
          cameraFps,
          effectiveFps: result.multiplier * cameraFps,
          afiMultiplier: result.multiplier > 1 ? result.multiplier : undefined,
          srEnabled: false,
          gpuBackend: result.backend === 'disabled' ? 'cpu' : result.backend,
          addedLatencyMs: result.latencyMs,
        });
        if (result.frames.length > 0) {
          inferenceFrame = result.frames[result.frames.length - 1];
        }
        result.frames.forEach((generated) => {
          if (generated !== inferenceFrame && generated !== videoFrame && generated instanceof VideoFrame) {
            generated.close();
          }
        });
      } catch (error) {
        console.warn('Interpolador AFI deshabilitado por error', error);
        interpolator = undefined;
        metrics = baseMetrics;
      }
    }

    const result = await landmarker.detectForVideo(inferenceFrame, timestamp);
    if (result.landmarks?.length) {
      renderSkeleton(result.landmarks[0], frame.width, frame.height);
      const bodyFrame = mapLandmarksToFrame(result.landmarks[0], timestamp);
      self.postMessage({ type: 'pose', frame: bodyFrame, metrics } satisfies WorkerResponse);
    } else {
      self.postMessage({ type: 'metrics', metrics } satisfies WorkerResponse);
    }

    if (supportsVideoFrame && inferenceFrame !== videoFrame && inferenceFrame instanceof VideoFrame) {
      inferenceFrame.close();
    }
    if (supportsVideoFrame && videoFrame instanceof VideoFrame) {
      videoFrame.close();
    }
  } catch (error) {
    console.error('Error procesando frame', error);
    self.postMessage({ type: 'error', message: (error as Error).message } satisfies WorkerResponse);
  } finally {
    frame.close();
  }
};
