import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    name: 'integration',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['./tests/integration/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
