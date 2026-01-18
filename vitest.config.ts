/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'apps/core-api/src/**/*.spec.ts',
      'apps/core-api/test/**/*.spec.ts',
      'tests/unit/**/*.spec.ts',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'build/',
      '.cache/',
      '**/*.d.ts',
      '**/*.config.{ts,js}',
      'tests/e2e/',
      'coverage/',
      // Exclude NestJS tests that require @nestjs/testing if they fail
      // 'apps/core-api/src/**/*/__tests__/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'json-summary', 'text-summary'],
      include: ['apps/core-api/src/**/*.ts'],
      exclude: [
        'packages/**',
        'apps/!(core-api)/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.cache/**',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/*.spec.ts',
        '**/*.test.ts',
        'tests/**',
        'coverage/**',
        'scripts/**',
        'docs/**',
        'memory/**',
        'apps/core-api/prisma/**',
        'apps/core-api/src/main.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
      reportOnFailure: true,
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    alias: {
      '@neuronx/config': path.resolve(
        __dirname,
        './packages/config/src/index.ts'
      ),
      '@neuronx/eventing': path.resolve(
        __dirname,
        './packages/eventing/src/index.ts'
      ),
      '@neuronx/adapters/webhooks': path.resolve(
        __dirname,
        './packages/adapters/webhooks/index.ts'
      ),
      '@neuronx/common': path.resolve(
        __dirname,
        './packages/common/src/index.ts'
      ),
      '@neuronx/token-vault': path.resolve(
        __dirname,
        './packages/security/src/index.ts'
      ),
      '@/': path.resolve(__dirname, './apps/core-api/src/'),
    },
  },
});
