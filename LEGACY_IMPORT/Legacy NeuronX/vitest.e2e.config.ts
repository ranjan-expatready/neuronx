/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/e2e/backend/**/*.spec.ts',
    ],
    exclude: [
      'node_modules/',
      'dist/',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    alias: {
      '@neuronx/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@neuronx/eventing': path.resolve(__dirname, './packages/eventing/src/index.ts'),
      '@neuronx/adapters/webhooks': path.resolve(__dirname, './packages/adapters/webhooks/index.ts'),
      '@neuronx/common': path.resolve(__dirname, './packages/common/src/index.ts'),
      '@neuronx/token-vault': path.resolve(__dirname, './packages/security/token-vault/index.ts'),
      '@neuronx/org-authority': path.resolve(__dirname, './packages/org-authority/src/index.ts'),
      '@neuronx/execution-authority': path.resolve(__dirname, './packages/execution-authority/src/index.ts'),
      '@neuronx/contracts': path.resolve(__dirname, './packages/contracts/src/index.ts'),
      '@neuronx/domain': path.resolve(__dirname, './packages/domain/models/index.ts'), // Check if it's models or services or root
      '@neuronx/billing-entitlements': path.resolve(__dirname, './packages/billing-entitlements/src/index.ts'),
      '@neuronx/ghl-read-adapter': path.resolve(__dirname, './packages/ghl-read-adapter/src/index.ts'),
      '@neuronx/voice-orchestration': path.resolve(__dirname, './packages/voice-orchestration/src/index.ts'),
      '@neuronx/scorecard-engine': path.resolve(__dirname, './packages/scorecard-engine/src/index.ts'),
      '@neuronx/uat-harness': path.resolve(__dirname, './packages/uat-harness/src/index.ts'),
      '@neuronx/production-readiness': path.resolve(__dirname, './packages/production-readiness/src/index.ts'),
      '@neuronx/execution-framework': path.resolve(__dirname, './packages/execution-framework/src/index.ts'),
      '@neuronx/adapters-ghl': path.resolve(__dirname, './packages/adapters-ghl/src/index.ts'),
      '@neuronx/webhooks': path.resolve(__dirname, './packages/adapters/webhooks/index.ts'), // Alias for @neuronx/webhooks
      '@/': path.resolve(__dirname, './apps/core-api/src/'),
    },
  },
});
