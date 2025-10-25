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

type WorkerMessage = InitMessage | FrameMessage;

declare const self: any;

let landmarker: PoseLandmarker | undefined;
let interpolator: AdaptiveFrameInterpolator | undefined;
let previewCtx: OffscreenCanvasRenderingContext2D | null = null;

const renderSkeleton = (landmarks: any[]) => {
  if (!previewCtx) return;
  previewCtx.clearRect(0, 0, previewCtx.canvas.width, previewCtx.canvas.height);
  const drawingUtils = new DrawingUtils(previewCtx);
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: '#4ade80',
    lineWidth: 3,
  });
  drawingUtils.drawLandmarks(landmarks, { color: '#f97316', radius: 4 });
};

const ensureLandmarker = async (modelAssetPath: string) => {
  if (landmarker) return;
  const fileset = await FilesetResolver.forVisionTasks(modelAssetPath);
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${modelAssetPath}/pose_landmarker_full.task`,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.4,
  });
};

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type === 'init') {
    const { canvas, modelAssetPath, video } = event.data;
    previewCtx = canvas ? canvas.getContext('2d') : null;
    await ensureLandmarker(modelAssetPath);
    interpolator = new AdaptiveFrameInterpolator({
      modelUrl: `${modelAssetPath}/rife-lite.onnx`,
      targetFps: video.targetFps,
      maxMultiplier: video.aiSmooth === 'off' ? 1 : 3,
    });
    return;
  }

  if (!landmarker) {
    return;
  }

  const { frame, timestamp, cameraFps } = event.data;
  const videoFrame = new VideoFrame(frame, { timestamp });
  const inferenceInput = { prev: videoFrame, next: videoFrame };
  const { frames, multiplier, latencyMs } = interpolator
    ? await interpolator.interpolate(inferenceInput, cameraFps)
    : { frames: [videoFrame], multiplier: 1, latencyMs: 0 };

  const lastFrame = frames[frames.length - 1];
  const result = await landmarker.detectForVideo(lastFrame, timestamp);
  if (result.landmarks?.length) {
    renderSkeleton(result.landmarks[0]);
    const bodyFrame = mapLandmarksToFrame(result.landmarks[0], timestamp);
    self.postMessage(
      {
        type: 'pose',
        frame: bodyFrame,
        metrics: {
          cameraFps,
          effectiveFps: cameraFps * multiplier,
          afiMultiplier: multiplier,
          srEnabled: false,
          gpuBackend: 'webgpu',
          addedLatencyMs: latencyMs,
        },
      },
      [],
    );
  }
  frames.forEach((f) => f.close());
  frame.close();
};
