import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up NeuronX E2E test environment...');

  // Perform any global cleanup tasks here
  // For example, clean up test data, close connections, etc.
  console.log('✅ Global E2E teardown completed');
}

export default globalTeardown;
