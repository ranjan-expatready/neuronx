/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'text-summary'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '.cache/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        'tests/',
        'coverage/',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
      reportOnFailure: true,
    },
  },
});
