import { create } from 'zustand';
import { FrameMetrics, stableFps } from '@trackeovrconia/utils';
import { BodyFrame, OscSink, Sink, ServerConfig, SlimeVrSink } from '@trackeovrconia/proto';

type VideoConfig = ServerConfig['video'];

type AppState = {
  videoConfig: VideoConfig;
  metrics?: FrameMetrics;
  lastFrame?: BodyFrame;
  sinks: Sink[];
  selectedCamera?: string;
  smoothingStrength: number;
  studioMode: 'standard' | 'studio';
  trackingActive: boolean;
  trackingError?: string;
  setVideoConfig: (config: VideoConfig) => void;
  setMetrics: (metrics: FrameMetrics) => void;
  setFrame: (frame: BodyFrame) => void;
  setSinks: (sinks: Sink[]) => void;
  selectCamera: (deviceId: string) => void;
  setSmoothing: (value: number) => void;
  toggleStudio: () => void;
  setTrackingActive: (active: boolean) => void;
  setTrackingError: (message?: string) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  videoConfig: {
    targetFps: 60,
    aiSmooth: 'auto',
    sr: 'off',
  },
  sinks: [],
  smoothingStrength: 0.5,
  studioMode: 'standard',
  trackingActive: false,
  setVideoConfig: (config) => set({ videoConfig: config }),
  setMetrics: (metrics) => {
    const base = get().videoConfig;
    set({
      metrics: {
        ...metrics,
        effectiveFps: metrics.effectiveFps || stableFps(metrics.cameraFps, base.targetFps),
      },
    });
  },
  setFrame: (frame) => set({ lastFrame: frame }),
  setSinks: (sinks) => set({ sinks }),
  selectCamera: (deviceId) => set({ selectedCamera: deviceId }),
  setSmoothing: (value) => set({ smoothingStrength: value }),
  toggleStudio: () => set((state) => ({ studioMode: state.studioMode === 'studio' ? 'standard' : 'studio' })),
  setTrackingActive: (active) =>
    set((state) => ({ trackingActive: active, trackingError: active ? undefined : state.trackingError })),
  setTrackingError: (message) => set({ trackingError: message }),
}));

export const groupSinks = (sinks: Sink[]): { osc: OscSink[]; slime: SlimeVrSink[] } => ({
  osc: sinks.filter((sink): sink is OscSink => sink.type === 'osc'),
  slime: sinks.filter((sink): sink is SlimeVrSink => sink.type === 'slimevr'),
});
