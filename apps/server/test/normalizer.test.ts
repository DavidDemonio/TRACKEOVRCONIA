import { describe, expect, it } from 'vitest';
import { defaultConfig } from '@trackeovrconia/proto';
import { FrameNormalizer } from '../src/services/normalizer.js';

describe('FrameNormalizer', () => {
  it('returns normalized frame', () => {
    const normalizer = new FrameNormalizer(defaultConfig);
    const frame = {
      timestamp: Date.now(),
      joints: {
        hip: { pos: [0, 1, 2], rotQuat: [0, 0, 0, 1], conf: 0.9 },
      },
    };
    const normalized = normalizer.normalize(frame);
    expect(normalized.joints.hip?.pos?.length).toBe(3);
  });
});
