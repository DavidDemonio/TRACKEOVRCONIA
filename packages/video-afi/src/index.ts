import { InferenceSession, Tensor } from 'onnxruntime-web';
import { stableFps } from '@trackeovrconia/utils';

export interface AfiConfig {
  modelUrl: string;
  targetFps: number;
  maxMultiplier: number;
}

export interface FramePair {
  prev: VideoFrame;
  next: VideoFrame;
}

export interface AfiResult {
  frames: VideoFrame[];
  multiplier: number;
  latencyMs: number;
  backend: 'webgpu' | 'webgl' | 'disabled';
}

export class AdaptiveFrameInterpolator {
  private session?: InferenceSession | null;
  private lastMultiplier = 1;
  private backend: AfiResult['backend'] = 'disabled';
  private disabled = false;

  constructor(private readonly config: AfiConfig) {}

  async ensureSession(): Promise<void> {
    if (this.session || this.disabled) return;
    try {
      this.session = await InferenceSession.create(this.config.modelUrl, {
        executionProviders: ['webgpu', 'webgl'],
      });
      const provider = (this.session as InferenceSession & { executionProvider?: string }).executionProvider;
      if (provider === 'webgpu' || provider === 'webgl') {
        this.backend = provider;
      } else if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        this.backend = 'webgpu';
      } else {
        this.backend = 'webgl';
      }
    } catch (error) {
      console.warn('AdaptiveFrameInterpolator: disabling due to initialisation error', error);
      this.session = null;
      this.disabled = true;
      this.backend = 'disabled';
    }
  }

  async interpolate({ prev, next }: FramePair, cameraFps: number): Promise<AfiResult> {
    const target = stableFps(cameraFps, this.config.targetFps);
    const multiplier = Math.min(
      this.config.maxMultiplier,
      Math.max(1, Math.round(target / Math.max(1, cameraFps))),
    );
    this.lastMultiplier = multiplier;

    if (multiplier === 1 || this.disabled) {
      return { frames: [next], multiplier: 1, latencyMs: 0, backend: this.backend };
    }

    await this.ensureSession();
    if (!this.session) {
      return { frames: [next], multiplier: 1, latencyMs: 0, backend: this.backend };
    }
    const start = performance.now();
    const inputs = await Promise.all([prev, next].map((frame) => this.frameToTensor(frame)));
    const results: VideoFrame[] = [];

    for (let i = 1; i < multiplier; i += 1) {
      const t = i / multiplier;
      const ortInputs = {
        prev: inputs[0],
        next: inputs[1],
        time: new Tensor('float32', new Float32Array([t]), [1]),
      } as Record<string, Tensor>;
      const output = await this.session!.run(ortInputs);
      const tensor = output.interpolated ?? Object.values(output)[0];
      const frame = await this.tensorToFrame(tensor, prev.displayWidth, prev.displayHeight);
      results.push(frame);
    }

    const latencyMs = performance.now() - start;
    return { frames: [...results, next], multiplier, latencyMs, backend: this.backend };
  }

  private async frameToTensor(frame: VideoFrame): Promise<Tensor> {
    const bitmap = await createImageBitmap(frame);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to get 2d context for frame conversion');
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = new Float32Array(canvas.width * canvas.height * 3);
    for (let i = 0; i < canvas.width * canvas.height; i += 1) {
      data[i * 3] = imageData.data[i * 4] / 255;
      data[i * 3 + 1] = imageData.data[i * 4 + 1] / 255;
      data[i * 3 + 2] = imageData.data[i * 4 + 2] / 255;
    }
    return new Tensor('float32', data, [1, canvas.height, canvas.width, 3]);
  }

  private async tensorToFrame(tensor: Tensor, width: number, height: number): Promise<VideoFrame> {
    const [batch, h, w, c] = tensor.dims;
    if (batch !== 1 || c !== 3) {
      throw new Error('Unexpected tensor dimensions');
    }
    const data = tensor.data as Float32Array;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create 2d context for tensor conversion');
    }
    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i += 1) {
      imageData.data[i * 4] = data[i * 3] * 255;
      imageData.data[i * 4 + 1] = data[i * 3 + 1] * 255;
      imageData.data[i * 4 + 2] = data[i * 3 + 2] * 255;
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    const bitmap = await createImageBitmap(canvas);
    return new VideoFrame(bitmap, { timestamp: performance.now(), displayWidth: width, displayHeight: height });
  }

  getMultiplier(): number {
    return this.lastMultiplier;
  }
}
