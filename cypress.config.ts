import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    video: true,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('before:run', details => {
        console.log('🚀 Starting Cypress test run:', details);
      });

      on('after:run', results => {
        console.log('✅ Cypress test run completed');
        console.log(
          `Tests: ${results.totalTests}, Passed: ${results.totalPassed}, Failed: ${results.totalFailed}`
        );
      });

      on('after:screenshot', details => {
        console.log('📸 Screenshot taken:', details.path);
      });
    },
  },
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
  },
});
