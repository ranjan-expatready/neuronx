import { test, expect } from '@playwright/test';

test.describe('Demo Runner E2E Flow', () => {
  test('should run complete NeuronX demo flow', async ({ page }) => {
    // Navigate to demo page
    await page.goto('/demo');

    // Start the demo
    await page
      .getByRole('button', { name: /start demo|run demonstration/i })
      .click();

    // Step 1: OAuth Integration Setup
    await expect(
      page.getByText(/oauth.*setup|integration.*configuration/i)
    ).toBeVisible();
    await page.getByRole('button', { name: /configure|setup/i }).click();

    // Mock OAuth completion (in real scenario, this would redirect)
    await page.evaluate(() => {
      // Simulate OAuth callback
      window.postMessage({ type: 'OAUTH_COMPLETE', success: true }, '*');
    });

    await expect(
      page.getByText(/oauth.*complete|integration.*ready/i)
    ).toBeVisible();

    // Step 2: Webhook Configuration
    await expect(
      page.getByText(/webhook.*setup|endpoint.*configuration/i)
    ).toBeVisible();
    await page
      .getByRole('button', { name: /configure.*webhooks|setup.*endpoints/i })
      .click();

    // Verify webhook URL is generated
    await expect(page.getByText(/https:\/\/.*\/webhooks/i)).toBeVisible();
    await page
      .getByRole('button', { name: /webhooks.*ready|continue/i })
      .click();

    // Step 3: Lead Creation and Processing
    await expect(
      page.getByText(/lead.*creation|contact.*processing/i)
    ).toBeVisible();

    // Simulate incoming webhook/lead
    await page.evaluate(() => {
      // Simulate webhook payload
      const webhookData = {
        type: 'contact.created',
        payload: {
          contact: {
            id: 'demo-contact-001',
            firstName: 'Demo',
            lastName: 'User',
            email: 'demo@example.com',
            company: 'DemoCorp',
            phone: '+1234567890',
          },
        },
      };
      window.postMessage({ type: 'WEBHOOK_RECEIVED', data: webhookData }, '*');
    });

    // Verify lead was created and processed
    await expect(
      page.getByText(/lead.*created|contact.*processed/i)
    ).toBeVisible();
    await expect(page.getByText(/demo@example\.com/i)).toBeVisible();

    // Step 4: Qualification Flow
    await expect(page.getByText(/qualification|scoring/i)).toBeVisible();

    // Wait for AI-enhanced scoring
    await expect(page.getByText(/enhanced.*score|ai.*scoring/i)).toBeVisible();

    // Check score display
    await expect(page.getByText(/\d+\/\d+/)).toBeVisible(); // Score format

    // Step 5: Routing Decision
    await expect(page.getByText(/routing|routing.*suggestion/i)).toBeVisible();

    // Verify team recommendation
    await expect(
      page.getByText(/recommended.*team|suggested.*assignment/i)
    ).toBeVisible();

    // Step 6: Cipher Monitoring
    await expect(
      page.getByText(/cipher.*monitoring|decision.*logged/i)
    ).toBeVisible();

    // Verify no blocking occurred (monitor mode)
    await expect(page.getByText(/approved|allowed|processed/i)).toBeVisible();

    // Step 7: Complete Demo
    await expect(
      page.getByText(/demo.*complete|processing.*finished/i)
    ).toBeVisible();

    // Check final results summary
    await expect(page.getByText(/summary|results|completed/i)).toBeVisible();

    // Verify all major components worked
    const results = await page.$$('.demo-result, .result-item');
    expect(results.length).toBeGreaterThan(5); // At least 6 major steps completed

    // Take final screenshot for evidence
    await page.screenshot({
      path: 'test-results/demo-complete.png',
      fullPage: true,
    });
  });

  test('should handle demo errors gracefully', async ({ page }) => {
    await page.goto('/demo');

    // Start demo
    await page.getByRole('button', { name: /start demo/i }).click();

    // Simulate an error during OAuth
    await page.evaluate(() => {
      window.postMessage(
        { type: 'OAUTH_ERROR', error: 'Connection failed' },
        '*'
      );
    });

    // Should show error but allow retry
    await expect(page.getByText(/error|failed/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /retry|try again/i })
    ).toBeVisible();

    // Retry should work
    await page.getByRole('button', { name: /retry/i }).click();

    // Mock successful retry
    await page.evaluate(() => {
      window.postMessage({ type: 'OAUTH_COMPLETE', success: true }, '*');
    });

    // Should continue with demo
    await expect(page.getByText(/oauth.*complete|continuing/i)).toBeVisible();
  });

  test('should demonstrate performance metrics', async ({ page }) => {
    await page.goto('/demo');

    // Start performance monitoring
    const startTime = Date.now();

    await page.getByRole('button', { name: /start demo/i }).click();

    // Complete the demo flow
    await page.evaluate(() => {
      // Fast-forward through demo steps
      window.postMessage({ type: 'OAUTH_COMPLETE', success: true }, '*');
      window.postMessage({ type: 'WEBHOOK_READY' }, '*');

      const leadData = {
        type: 'contact.created',
        payload: {
          contact: {
            id: 'perf-test-001',
            firstName: 'Performance',
            lastName: 'Test',
            email: 'perf@test.com',
            company: 'PerfCorp',
          },
        },
      };
      window.postMessage({ type: 'WEBHOOK_RECEIVED', data: leadData }, '*');
    });

    // Wait for completion
    await expect(page.getByText(/demo.*complete|finished/i)).toBeVisible();

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Verify performance is reasonable (< 30 seconds for demo)
    expect(totalTime).toBeLessThan(30000);

    // Check performance metrics are displayed
    await expect(page.getByText(/performance|timing|latency/i)).toBeVisible();

    console.log(`Demo completed in ${totalTime}ms`);
  });
});
