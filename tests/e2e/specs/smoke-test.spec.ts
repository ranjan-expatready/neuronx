import { test, expect } from '@playwright/test';
import { AuthHelper, OAuthHelper } from '../helpers/auth-helper';
import { EnvHelper } from '../helpers/env-helper';

/**
 * Smoke Test - Critical Happy Path Validation
 *
 * This test verifies the most critical user journey:
 * OAuth install flow → successful callback → token saved → health endpoint returns OK
 */
test.describe('Smoke Test - Critical OAuth Flow', () => {
  let authHelper: AuthHelper;
  let oauthHelper: OAuthHelper;
  let envHelper: EnvHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    oauthHelper = new OAuthHelper(page);
    envHelper = new EnvHelper();

    // Ensure application is ready
    await envHelper.waitForAppReady();
  });

  test('complete OAuth install flow should result in healthy integration', async ({
    page,
  }) => {
    // Step 1: Verify application health before starting
    const initialHealth = await envHelper.isAppHealthy();
    expect(initialHealth).toBe(true);

    // Step 2: Navigate to GHL integration install page
    await page.goto('/integrations/ghl/install');

    // Verify install page loads correctly
    await expect(page).toHaveTitle(/NeuronX|GHL Integration/);
    await expect(
      page.getByRole('heading', { name: /ghl|gohighlevel|integration/i })
    ).toBeVisible();

    // Step 3: Initiate OAuth flow
    await oauthHelper.initiateGHLIntegration();

    // Should redirect to GHL OAuth page (or mock for testing)
    await expect(page).toHaveURL(/gohighlevel\.com/);

    // Verify OAuth parameters are present
    const url = new URL(page.url());
    expect(url.searchParams.has('client_id')).toBe(true);
    expect(url.searchParams.has('redirect_uri')).toBe(true);
    expect(url.searchParams.has('state')).toBe(true);
    expect(url.searchParams.has('scope')).toBe(true);

    // Step 4: Mock successful OAuth callback
    await oauthHelper.mockOAuthCallback(true);

    // Should redirect back to application
    await expect(page).toHaveURL(/\/dashboard|\/integrations|\/success/);

    // Step 5: Verify integration success
    await expect(
      page.getByText(
        /successfully connected|integration complete|ghl connected/i
      )
    ).toBeVisible();

    // Step 6: Verify token was saved (check for auth token in localStorage)
    const authToken = await authHelper.getAuthToken();
    expect(authToken).toBeTruthy();
    expect(typeof authToken).toBe('string');
    expect(authToken.length).toBeGreaterThan(10); // Basic token validation

    // Step 7: Verify health endpoint still returns OK after integration
    const finalHealth = await envHelper.isAppHealthy();
    expect(finalHealth).toBe(true);

    // Step 8: Verify integration status in UI
    await page.goto('/integrations');
    await expect(
      page.getByText(/ghl.*active|connected|enabled/i)
    ).toBeVisible();

    // Step 9: Test basic API functionality with new integration
    const apiContext = await envHelper.getApiContext();
    const healthResponse = await apiContext.get('/health');
    expect(healthResponse.ok()).toBe(true);

    // Step 10: Verify no errors in application logs (if accessible via UI)
    const hasErrors = await page
      .locator('[data-testid="error"], .error, .alert-danger')
      .count();
    expect(hasErrors).toBe(0);
  });

  test('OAuth failure should be handled gracefully', async ({ page }) => {
    // Step 1: Initiate OAuth flow
    await page.goto('/integrations/ghl/install');
    await oauthHelper.initiateGHLIntegration();

    // Step 2: Mock failed OAuth callback
    await oauthHelper.mockOAuthCallback(false);

    // Should show error but not crash
    await expect(page.getByText(/failed|error|denied/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /retry|try again/i })
    ).toBeVisible();

    // Application should still be healthy
    const healthAfterFailure = await envHelper.isAppHealthy();
    expect(healthAfterFailure).toBe(true);

    // Should not have saved invalid token
    const authToken = await authHelper.getAuthToken();
    expect(authToken).toBeFalsy();
  });

  test('health endpoint should remain accessible throughout OAuth flow', async () => {
    // Test health endpoint accessibility during various states

    // Before any OAuth activity
    let health = await envHelper.isAppHealthy();
    expect(health).toBe(true);

    // During simulated OAuth flow (we can't actually test this without real OAuth)
    // But we can verify the endpoint remains accessible
    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay

    health = await envHelper.isAppHealthy();
    expect(health).toBe(true);

    // After potential state changes
    await new Promise(resolve => setTimeout(resolve, 1000));

    health = await envHelper.isAppHealthy();
    expect(health).toBe(true);
  });

  test('integration status should persist across page reloads', async ({
    page,
  }) => {
    // This test assumes a successful integration from previous tests
    // In a real scenario, this would be seeded

    await page.goto('/integrations');

    // Check initial integration status
    const initialStatus = await page
      .locator('[data-testid="ghl-status"], .integration-status')
      .textContent();

    // Reload page
    await page.reload();

    // Status should be the same
    const reloadedStatus = await page
      .locator('[data-testid="ghl-status"], .integration-status')
      .textContent();
    expect(reloadedStatus).toBe(initialStatus);
  });
});
