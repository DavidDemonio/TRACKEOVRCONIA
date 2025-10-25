export * from './filters.js';

export interface FrameMetrics {
  cameraFps: number;
  effectiveFps: number;
  afiMultiplier?: number;
  srEnabled?: boolean;
  gpuBackend?: string;
  addedLatencyMs?: number;
}

export const stableFps = (cameraFps: number, target = 60): number => {
  if (cameraFps >= target) return target;
  const multiplier = Math.min(3, Math.max(2, Math.ceil(target / Math.max(1, cameraFps))));
  return Math.min(target, cameraFps * multiplier);
};
