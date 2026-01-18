import { test, expect } from '@playwright/test';

test.describe('OAuth Install + Callback Flows', () => {
  test('should complete OAuth install flow', async ({ page, context }) => {
    // Navigate to OAuth install page
    await page.goto('/integrations/ghl/install');

    // Click install button
    await page.getByRole('button', { name: /install/i }).click();

    // Should redirect to GHL OAuth
    await expect(page).toHaveURL(/gohighlevel\.com/);

    // Mock OAuth approval (in real test, this would be manual or automated)
    // For now, we'll test the redirect and state handling
    const url = new URL(page.url());
    expect(url.searchParams.has('state')).toBeTruthy();
    expect(url.searchParams.has('client_id')).toBeTruthy();
  });

  test('should handle OAuth callback successfully', async ({ page }) => {
    // Simulate OAuth callback with mock parameters
    const mockAuthCode = 'mock_auth_code_123';
    const mockState = 'mock_state_456';

    await page.goto(
      `/integrations/ghl/callback?code=${mockAuthCode}&state=${mockState}`
    );

    // Should redirect to success page or dashboard
    await expect(page).toHaveURL(/\/dashboard|\/success/);

    // Should show success message
    await expect(
      page.getByText(/successfully connected|integration complete/i)
    ).toBeVisible();
  });

  test('should handle OAuth callback errors', async ({ page }) => {
    // Test error handling
    await page.goto(
      '/integrations/ghl/callback?error=access_denied&error_description=User%20denied%20access'
    );

    // Should show error message
    await expect(
      page.getByText(/access denied|connection failed/i)
    ).toBeVisible();

    // Should provide retry option
    await expect(
      page.getByRole('button', { name: /try again|retry/i })
    ).toBeVisible();
  });
});
