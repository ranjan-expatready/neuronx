import { APIRequestContext, request } from '@playwright/test';

/**
 * Environment helper for E2E tests
 */
export class EnvHelper {
  private apiContext: APIRequestContext | null = null;

  /**
   * Get base URL for the application
   */
  static getBaseUrl(): string {
    return process.env.BASE_URL || 'http://localhost:3000';
  }

  /**
   * Get API base URL
   */
  static getApiBaseUrl(): string {
    return process.env.API_BASE_URL || 'http://localhost:3000/api';
  }

  /**
   * Check if application is healthy
   */
  async isAppHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${EnvHelper.getBaseUrl()}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Wait for application to be ready
   */
  async waitForAppReady(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isAppHealthy()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Application failed to become ready within timeout');
  }

  /**
   * Get API request context for direct API calls
   */
  async getApiContext(): Promise<APIRequestContext> {
    if (!this.apiContext) {
      this.apiContext = await request.newContext({
        baseURL: EnvHelper.getApiBaseUrl(),
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      });
    }
    return this.apiContext;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.apiContext) {
      await this.apiContext.dispose();
      this.apiContext = null;
    }
  }

  /**
   * Reset test environment (clear test data, reset state)
   */
  async resetTestEnvironment(): Promise<void> {
    const context = await this.getApiContext();

    try {
      // Call test cleanup endpoint if available
      await context.delete('/test/cleanup');
    } catch (error) {
      console.warn('Test cleanup endpoint not available:', error.message);
    }
  }

  /**
   * Seed test data
   */
  async seedTestData(fixtures?: any): Promise<void> {
    const context = await this.getApiContext();

    try {
      // Call test seeding endpoint if available
      await context.post('/test/seed', {
        data: fixtures || this.getDefaultTestFixtures(),
      });
    } catch (error) {
      console.warn('Test seeding endpoint not available:', error.message);
    }
  }

  /**
   * Get default test fixtures for seeding
   */
  private getDefaultTestFixtures() {
    return {
      tenants: [
        {
          id: 'test-tenant-1',
          name: 'Test Tenant 1',
          domain: 'test1.neuronx.com',
        },
      ],
      leads: [
        {
          id: 'test-lead-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@test.com',
          company: 'TestCorp',
          tenantId: 'test-tenant-1',
        },
      ],
      integrations: [
        {
          tenantId: 'test-tenant-1',
          provider: 'ghl',
          status: 'active',
          config: {
            apiKey: 'test_api_key',
            locationId: 'test_location_id',
          },
        },
      ],
    };
  }
}

/**
 * Database helper for direct database operations in tests
 */
export class DatabaseHelper {
  /**
   * Reset database to clean state
   */
  static async resetDatabase(): Promise<void> {
    // This would typically connect directly to the test database
    // For now, we'll use the API endpoints
    const envHelper = new EnvHelper();
    await envHelper.resetTestEnvironment();
  }

  /**
   * Seed database with test data
   */
  static async seedDatabase(fixtures?: any): Promise<void> {
    const envHelper = new EnvHelper();
    await envHelper.seedTestData(fixtures);
  }

  /**
   * Clean up database after tests
   */
  static async cleanupDatabase(): Promise<void> {
    const envHelper = new EnvHelper();
    await envHelper.resetTestEnvironment();
  }
}
