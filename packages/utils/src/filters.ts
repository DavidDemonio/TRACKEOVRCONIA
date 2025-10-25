export interface OneEuroFilterConfig {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

class LowPassFilter {
  private alpha: number;
  private prev?: number;

  constructor(alpha: number) {
    this.alpha = alpha;
  }

  filter(value: number): number {
    if (this.prev === undefined) {
      this.prev = value;
      return value;
    }
    const result = this.alpha * value + (1 - this.alpha) * this.prev;
    this.prev = result;
    return result;
  }

  setAlpha(alpha: number) {
    this.alpha = alpha;
  }
}

export class OneEuroFilter {
  private readonly config: OneEuroFilterConfig;
  private readonly freq: number;
  private readonly valueFilters: Map<string, LowPassFilter> = new Map();
  private readonly derivFilters: Map<string, LowPassFilter> = new Map();
  private readonly lastTime: Map<string, number> = new Map();

  constructor(freq: number, config: Partial<OneEuroFilterConfig> = {}) {
    this.freq = freq;
    this.config = {
      minCutoff: config.minCutoff ?? 1.0,
      beta: config.beta ?? 0.01,
      dCutoff: config.dCutoff ?? 1.0,
    };
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filterVector(id: string, values: number[], timestamp: number): number[] {
    const prevTime = this.lastTime.get(id) ?? timestamp;
    const dt = Math.max((timestamp - prevTime) / 1000, 1 / this.freq);
    this.lastTime.set(id, timestamp);

    const vFilters = this.valueFilters.get(id) ?? new LowPassFilter(1);
    const dFilters = this.derivFilters.get(id) ?? new LowPassFilter(1);
    this.valueFilters.set(id, vFilters);
    this.derivFilters.set(id, dFilters);

    return values.map((value, index) => {
      const prev = vFilters.filter(value);
      const deriv = (value - prev) * this.freq;
      dFilters.setAlpha(this.alpha(this.config.dCutoff, dt));
      const dValue = dFilters.filter(deriv);
      const cutoff = this.config.minCutoff + this.config.beta * Math.abs(dValue);
      vFilters.setAlpha(this.alpha(cutoff, dt));
      return vFilters.filter(value);
    });
  }
}

export interface KalmanConfig {
  r: number;
  q: number;
}

export class KalmanFilter {
  private readonly config: KalmanConfig;
  private readonly state: Map<string, { value: number; p: number }[]> = new Map();

  constructor(config: Partial<KalmanConfig> = {}) {
    this.config = {
      r: config.r ?? 0.01,
      q: config.q ?? 1,
    };
  }

  filterVector(id: string, values: number[]): number[] {
    const previous = this.state.get(id) ?? values.map((value) => ({ value, p: 1 }));
    const result = values.map((value, index) => {
      const { value: prevValue, p } = previous[index];
      const pPred = p + this.config.q;
      const k = pPred / (pPred + this.config.r);
      const newValue = prevValue + k * (value - prevValue);
      const newP = (1 - k) * pPred;
      previous[index] = { value: newValue, p: newP };
      return newValue;
    });
    this.state.set(id, previous);
    return result;
  }
}
