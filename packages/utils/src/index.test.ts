import { describe, expect, it } from 'vitest';
import { OneEuroFilter, stableFps } from './index.js';

describe('stableFps', () => {
  it('boosts fps when camera is slow', () => {
    expect(stableFps(24)).toBe(60);
    expect(stableFps(30)).toBe(60);
  });
});

describe('OneEuroFilter', () => {
  it('smooths noisy data', () => {
    const filter = new OneEuroFilter(60, { beta: 0.02, minCutoff: 1 });
    const noisy = [0, 1, 0.5, 0.1, 0.9];
    const filtered = noisy.map((value, index) => filter.filterVector('joint', [value, value, value], index * 16)[0]);
    expect(filtered[filtered.length - 1]).toBeLessThan(0.9);
  });
});
