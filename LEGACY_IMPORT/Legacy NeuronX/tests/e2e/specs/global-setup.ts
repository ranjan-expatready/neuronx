import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up NeuronX E2E test environment...');

  // Start a browser instance for setup tasks if needed
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Perform any global setup tasks here
    // For example, seed test data, warm up services, etc.
    console.log('✅ Global E2E setup completed');
  } catch (error) {
    console.error('❌ Global E2E setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
