import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (!global.fetch) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({}),
  })) as unknown as typeof fetch;
}
