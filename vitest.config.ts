import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'packages/cli/tests/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@cli': path.resolve(__dirname, './src'),
    },
  },
});
