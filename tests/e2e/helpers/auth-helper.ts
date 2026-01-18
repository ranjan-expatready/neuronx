import { Page } from '@playwright/test';

/**
 * Authentication helper for E2E tests
 */
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Perform OAuth login flow
   */
  async loginAsAdmin() {
    // Navigate to login page
    await this.page.goto('/login');

    // Fill credentials
    await this.page
      .getByLabel('Email')
      .fill(process.env.ADMIN_EMAIL || 'admin@neuronx.com');
    await this.page
      .getByLabel('Password')
      .fill(process.env.ADMIN_PASSWORD || 'password123');

    // Submit login
    await this.page.getByRole('button', { name: /login|sign in/i }).click();

    // Wait for successful login
    await this.page.waitForURL('**/dashboard**');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.page.waitForSelector(
        '[data-testid="user-menu"], .user-menu, [data-testid="logout"]',
        { timeout: 2000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    await this.page.getByRole('button', { name: /logout|sign out/i }).click();
    await this.page.waitForURL('**/login**');
  }

  /**
   * Get authentication token from localStorage
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return (
        localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
      );
    });
  }
}

/**
 * OAuth flow helper for E2E tests
 */
export class OAuthHelper {
  constructor(private page: Page) {}

  /**
   * Initiate OAuth flow for GHL integration
   */
  async initiateGHLIntegration() {
    await this.page.goto('/integrations/ghl/install');

    // Click install/connect button
    await this.page
      .getByRole('button', { name: /install|connect|integrate/i })
      .click();

    // Should redirect to GHL OAuth
    await this.page.waitForURL('**/gohighlevel.com/**');
  }

  /**
   * Mock OAuth callback (for testing without real GHL)
   */
  async mockOAuthCallback(success: boolean = true) {
    const callbackUrl = success
      ? '/integrations/ghl/callback?code=mock_auth_code&state=mock_state'
      : '/integrations/ghl/callback?error=access_denied';

    await this.page.goto(callbackUrl);

    if (success) {
      await this.page.waitForURL('**/dashboard**');
      // Verify success message
      await this.page
        .getByText(/successfully connected|integration complete/i)
        .isVisible();
    } else {
      // Verify error handling
      await this.page.getByText(/access denied|connection failed/i).isVisible();
    }
  }
}
