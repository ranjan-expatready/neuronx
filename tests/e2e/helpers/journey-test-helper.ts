/**
 * Journey Test Helper - WI-068: E2E Journey Proof Pack
 *
 * Specialized helper for end-to-end journey testing across all NeuronX surfaces.
 * Provides utilities for UAT verification, service health checks, and audit validation.
 */

import { APIRequestContext } from '@playwright/test';
import { EnvHelper } from './env-helper';

export class JourneyTestHelper {
  private envHelper: EnvHelper;
  private apiContext: APIRequestContext | null = null;

  constructor(envHelper: EnvHelper) {
    this.envHelper = envHelper;
  }

  /**
   * Verify all UAT services are ready for testing
   */
  async verifyUatServicesReady(): Promise<void> {
    console.log('🔍 Verifying UAT services readiness...');

    // Check environment variables
    this.validateUatEnvironment();

    // Check service health
    await this.verifyServiceHealth();

    // Verify UAT harness status
    await this.verifyUatHarnessStatus();

    console.log('✅ All UAT services ready for testing');
  }

  /**
   * Validate UAT environment configuration
   */
  private validateUatEnvironment(): void {
    const neuronxEnv = process.env.NEURONX_ENV;
    const uatMode = process.env.UAT_MODE;

    if (neuronxEnv !== 'uat') {
      throw new Error(
        `Invalid environment: expected 'uat', got '${neuronxEnv}'`
      );
    }

    if (uatMode !== 'dry_run') {
      throw new Error(`Invalid UAT mode: expected 'dry_run', got '${uatMode}'`);
    }

    const uatTenantId = process.env.UAT_TENANT_ID || 'uat-tenant-001';
    if (!uatTenantId) {
      throw new Error('UAT_TENANT_ID environment variable is required');
    }

    console.log(
      `✅ Environment validated: ${neuronxEnv}/${uatMode} with tenant ${uatTenantId}`
    );
  }

  /**
   * Verify all services are healthy
   */
  private async verifyServiceHealth(): Promise<void> {
    const services = [
      {
        name: 'Core API',
        url: process.env.API_BASE_URL || 'http://localhost:3000',
      },
      {
        name: 'Operator UI',
        url: process.env.OPERATOR_BASE_URL || 'http://localhost:3001',
      },
      {
        name: 'Manager UI',
        url: process.env.MANAGER_BASE_URL || 'http://localhost:3002',
      },
      {
        name: 'Executive UI',
        url: process.env.EXECUTIVE_BASE_URL || 'http://localhost:3003',
      },
    ];

    for (const service of services) {
      try {
        const response = await fetch(`${service.url}/health`, {
          timeout: 5000,
        });
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }
        console.log(`✅ ${service.name} health check passed`);
      } catch (error) {
        throw new Error(
          `${service.name} health check failed: ${error.message}`
        );
      }
    }
  }

  /**
   * Verify UAT harness is properly configured
   */
  private async verifyUatHarnessStatus(): Promise<void> {
    try {
      const apiContext = await this.getApiContext();
      const response = await apiContext.get('/uat/status');

      if (!response.ok()) {
        throw new Error(`UAT status check failed: ${response.status()}`);
      }

      const statusData = await response.json();

      // Verify UAT harness is active
      if (statusData.environment !== 'uat') {
        throw new Error(
          `UAT harness not in correct environment: ${statusData.environment}`
        );
      }

      if (statusData.mode !== 'dry_run') {
        throw new Error(`UAT harness not in dry_run mode: ${statusData.mode}`);
      }

      if (!statusData.killSwitch) {
        throw new Error(
          'UAT kill switch is not active - external side effects may occur'
        );
      }

      console.log('✅ UAT harness status verified');
    } catch (error) {
      throw new Error(`UAT harness verification failed: ${error.message}`);
    }
  }

  /**
   * Get UAT audit events for verification
   */
  async getUatAuditEvents(
    tenantId: string,
    correlationId?: string
  ): Promise<any[]> {
    try {
      const apiContext = await this.getApiContext();

      const params = new URLSearchParams();
      if (correlationId) {
        params.set('correlationId', correlationId);
      }
      params.set('limit', '100'); // Get more events for comprehensive checking

      const response = await apiContext.get(`/uat/audit?${params}`, {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      if (!response.ok()) {
        throw new Error(`Audit events fetch failed: ${response.status()}`);
      }

      const auditData = await response.json();
      return auditData.events || [];
    } catch (error) {
      console.warn(`Failed to fetch audit events: ${error.message}`);
      return [];
    }
  }

  /**
   * Verify all services remain healthy
   */
  async verifyAllServicesHealthy(): Promise<boolean> {
    try {
      await this.verifyServiceHealth();
      return true;
    } catch (error) {
      console.error(`Service health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check for external side effects (emails, SMS, etc.)
   */
  async checkForExternalSideEffects(): Promise<boolean> {
    // This would typically check external service logs or mocks
    // For now, we rely on UAT harness kill switch verification

    try {
      const apiContext = await this.getApiContext();
      const response = await apiContext.get('/uat/status');

      if (response.ok()) {
        const statusData = await response.json();
        return statusData.killSwitch === true && statusData.mode === 'dry_run';
      }

      return false;
    } catch (error) {
      console.error(`Side effects check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate deterministic test data for journeys
   */
  generateTestData(journeyType: 'operator' | 'manager' | 'executive') {
    const timestamp = Date.now();
    const correlationId = `${journeyType}_journey_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      correlationId,
      tenantId: process.env.UAT_TENANT_ID || 'uat-tenant-001',
      timestamp,
      journeyType,
      testData: this.getJourneySpecificData(journeyType),
    };
  }

  /**
   * Get journey-specific test data
   */
  private getJourneySpecificData(journeyType: string) {
    switch (journeyType) {
      case 'operator':
        return {
          expectedUatBanner: true,
          expectedScorecard: true,
          expectedWorkQueue: true,
          expectedAuditEvents: true,
        };

      case 'manager':
        return {
          expectedTeamScorecard: true,
          expectedRepPerformance: true,
          expectedCoachingSection: true,
          expectedEvidenceDrawer: true,
        };

      case 'executive':
        return {
          expectedConfidenceCards: 4,
          expectedEvidenceDrawer: true,
          expectedAggregateOnly: true,
          expectedPolicyRefs: true,
        };

      default:
        return {};
    }
  }

  /**
   * Wait for UAT-specific elements to be ready
   */
  async waitForUatElements(page: any, selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      await page.waitForSelector(selector, { timeout: 10000 });
    }
  }

  /**
   * Get API context for direct API calls
   */
  private async getApiContext(): Promise<APIRequestContext> {
    if (!this.apiContext) {
      this.apiContext = await this.envHelper.getApiContext();
    }
    return this.apiContext;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.apiContext) {
      await this.apiContext.dispose();
      this.apiContext = null;
    }
  }

  /**
   * Generate test IDs for deterministic element selection
   */
  static generateTestId(
    component: string,
    element: string,
    index?: number
  ): string {
    const baseId = `${component}-${element}`;
    return index !== undefined ? `${baseId}-${index}` : baseId;
  }

  /**
   * Attempt a GHL mutation to verify read-only enforcement (WI-070C)
   */
  async attemptGhlMutation(operation: string, data: any): Promise<any> {
    const apiContext = await this.getApiContext();

    try {
      // Try various mutation endpoints that should be blocked
      const mutationEndpoints = [
        `/ghl-read/contacts`,
        `/ghl-read/opportunities`,
        `/ghl-read/pipelines`,
        `/ghl-write/contacts`, // Even if this endpoint doesn't exist, test the attempt
        `/ghl-write/opportunities`,
        `/ghl-write/pipelines`,
      ];

      for (const endpoint of mutationEndpoints) {
        try {
          // Try POST (create)
          await apiContext.post(
            `${this.envHelper.getApiBaseUrl()}${endpoint}`,
            {
              data: { ...data, operation },
            }
          );
        } catch (error) {
          // Expected - mutations should be blocked
          if (
            error.message.includes('READ-ONLY VIOLATION') ||
            error.message.includes('mutation') ||
            error.message.includes('not permitted')
          ) {
            return { blocked: true, operation, endpoint, error: error.message };
          }
          throw error; // Unexpected error
        }

        try {
          // Try PUT (update)
          await apiContext.put(
            `${this.envHelper.getApiBaseUrl()}${endpoint}/123`,
            {
              data: { ...data, operation },
            }
          );
        } catch (error) {
          // Expected - mutations should be blocked
          if (
            error.message.includes('READ-ONLY VIOLATION') ||
            error.message.includes('mutation') ||
            error.message.includes('not permitted')
          ) {
            return { blocked: true, operation, endpoint, error: error.message };
          }
          throw error; // Unexpected error
        }

        try {
          // Try DELETE
          await apiContext.delete(
            `${this.envHelper.getApiBaseUrl()}${endpoint}/123`
          );
        } catch (error) {
          // Expected - mutations should be blocked
          if (
            error.message.includes('READ-ONLY VIOLATION') ||
            error.message.includes('mutation') ||
            error.message.includes('not permitted')
          ) {
            return { blocked: true, operation, endpoint, error: error.message };
          }
          throw error; // Unexpected error
        }
      }

      // If we get here, no mutations were blocked - this is a test failure
      throw new Error(
        `No mutation blocking detected for operation: ${operation}`
      );
    } catch (error) {
      throw new Error(`READ-ONLY VIOLATION TEST FAILED: ${error.message}`);
    }
  }

  /**
   * Common test selectors used across journeys
   */
  static readonly SELECTORS = {
    // UAT elements
    UAT_BANNER: '[data-testid="uat-banner"]',
    UAT_MODE: '[data-testid="uat-mode"]',
    UAT_KILL_SWITCH: '[data-testid="uat-kill-switch"]',

    // Scorecard elements
    SCORECARD_STRIP: '[data-testid="scorecard-strip"]',
    TEAM_SCORECARD: '[data-testid="team-scorecard"]',

    // Work queue elements
    WORK_QUEUE_ITEM: '[data-testid="work-queue-item"]',
    QUEUE_ITEM_FIRST: '[data-testid="work-queue-item"]:first-child',

    // Evidence elements
    EVIDENCE_BUTTON: '[data-testid="evidence-button"]',
    EVIDENCE_DRAWER: '[data-testid="evidence-drawer"]',
    EVIDENCE_MODAL: '[data-testid="evidence-modal"]',

    // Confidence elements
    CONFIDENCE_CARD: '[data-testid="confidence-card"]',
    CONFIDENCE_SYSTEM_READINESS:
      '[data-testid="confidence-card"]:has-text("System Readiness")',
    CONFIDENCE_GOVERNANCE_RISK:
      '[data-testid="confidence-card"]:has-text("Governance Risk")',
    CONFIDENCE_REVENUE_INTEGRITY:
      '[data-testid="confidence-card"]:has-text("Revenue Integrity")',
    CONFIDENCE_GROWTH_EFFICIENCY:
      '[data-testid="confidence-card"]:has-text("Growth Efficiency")',

    // Rep elements
    REP_ROW: '[data-testid="rep-row"]',
    REP_DETAILS_BUTTON: '[data-testid="rep-details-button"]',
    COACHING_SECTION: '[data-testid="coaching-section"]',

    // Action elements
    DRY_RUN_BUTTON: '[data-testid="dry-run-button"]',
    SUCCESS_MESSAGE: '[data-testid="success-message"]',
    ERROR_MESSAGE: '[data-testid="error-message"]',

    // Access control
    ACCESS_DENIED: '[data-testid="access-denied"]',
    REDIRECT_MESSAGE: '[data-testid="redirect-message"]',

    // Evidence details
    POLICY_VERSION: '[data-testid="policy-version"]',
    CORRELATION_ID: '[data-testid="correlation-id"]',
    INDIVIDUAL_RECORD: '[data-testid="individual-record"]',
    POLICY_REFERENCE: '[data-testid="policy-reference"]',
    CLOSE_EVIDENCE: '[data-testid="close-evidence"]',
    EVIDENCE_LINK: '[data-testid="evidence-link"]',
  } as const;
}
