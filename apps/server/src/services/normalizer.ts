import { BodyFrame, JointName, ServerConfig } from '@trackeovrconia/proto';
import { KalmanFilter, OneEuroFilter } from '@trackeovrconia/utils';

export class FrameNormalizer {
  private oneEuro?: OneEuroFilter;
  private kalman?: KalmanFilter;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.updateConfig(config);
  }

  updateConfig(config: ServerConfig): void {
    this.config = config;
    if (config.smoothing.filter === 'one-euro') {
      this.oneEuro = new OneEuroFilter(config.video.targetFps, {
        beta: config.smoothing.beta,
        minCutoff: config.smoothing.minCutoff,
      });
      this.kalman = undefined;
    } else {
      this.kalman = new KalmanFilter({ r: config.smoothing.r, q: config.smoothing.q });
      this.oneEuro = undefined;
    }
  }

  normalize(frame: BodyFrame): BodyFrame {
    const joints: BodyFrame['joints'] = {};
    (Object.keys(frame.joints) as JointName[]).forEach((joint) => {
      const data = frame.joints[joint];
      if (!data) return;
      const timestamp = frame.timestamp ?? Date.now();
      const smoothedPos = data.pos
        ? this.applyFilter(`${joint}-pos`, data.pos, timestamp)
        : undefined;
      const smoothedRot = data.rotQuat
        ? this.applyFilter(`${joint}-rot`, data.rotQuat, timestamp)
        : undefined;
      joints[joint] = {
        pos: smoothedPos ?? data.pos,
        rotQuat: smoothedRot ?? data.rotQuat,
        conf: data.conf,
      };
    });
    return { ...frame, joints };
  }

  private applyFilter<T extends number[]>(id: string, values: T, timestamp: number): T | undefined {
    if (this.oneEuro) {
      return this.oneEuro.filterVector(id, values, timestamp) as T;
    }
    if (this.kalman) {
      return this.kalman.filterVector(id, values) as T;
    }
    return undefined;
  }
}
