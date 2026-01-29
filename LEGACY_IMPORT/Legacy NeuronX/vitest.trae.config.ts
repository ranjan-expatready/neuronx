/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['.trae/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['node_modules/'],
    },
    testTimeout: 5000,
  },
});
