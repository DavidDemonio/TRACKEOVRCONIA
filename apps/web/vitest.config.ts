import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve as resolvePath } from 'path';

const rootDir = dirname(fileURLToPath(import.meta.url));
const alias = {
  '@trackeovrconia/proto': resolvePath(rootDir, 'src/types/proto.ts'),
  '@trackeovrconia/utils': resolvePath(rootDir, 'src/types/utils.ts'),
  '@trackeovrconia/video-afi': resolvePath(rootDir, 'src/types/video-afi.ts'),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
