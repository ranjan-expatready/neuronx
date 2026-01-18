/**
 * Readiness API Client - WI-061: UI Infrastructure & Governance Layer
 *
 * Typed client for readiness dashboard endpoints.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ReadinessDomain, ApiResponse } from '../types';
import { httpClient } from '../http/client';
import { getTenantId } from '../auth/principal';
import { CorrelationContext } from '../http/correlation';

/**
 * Readiness API Client
 * Provides typed access to readiness dashboard endpoints
 */
export class ReadinessApiClient {
  /**
   * Get comprehensive readiness report for current tenant
   */
  async getReadinessReport(
    includeDetails: boolean = true,
    correlationId?: string
  ): Promise<any> {
    const tenantId = await getTenantId();
    const requestCorrelationId = correlationId || CorrelationContext.get();

    const response: ApiResponse<any> = await httpClient.get(
      `/readiness/${tenantId}`,
      {
        correlationId: requestCorrelationId,
        tenantId,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get readiness report');
    }

    return response.data;
  }

  /**
   * Get specific domain status for current tenant
   */
  async getDomainStatus(
    domain: ReadinessDomain,
    correlationId?: string
  ): Promise<any> {
    const tenantId = await getTenantId();
    const requestCorrelationId = correlationId || CorrelationContext.get();

    const response: ApiResponse<any> = await httpClient.get(
      `/readiness/${tenantId}/domain/${domain}`,
      {
        correlationId: requestCorrelationId,
        tenantId,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || `Failed to get ${domain} status`);
    }

    return response.data;
  }

  /**
   * Get system health domain status
   */
  async getSystemHealth(): Promise<any> {
    return this.getDomainStatus(ReadinessDomain.SYSTEM_HEALTH);
  }

  /**
   * Get governance signals domain status
   */
  async getGovernanceSignals(): Promise<any> {
    return this.getDomainStatus(ReadinessDomain.GOVERNANCE);
  }

  /**
   * Get GHL trust signals domain status
   */
  async getGhlTrustSignals(): Promise<any> {
    return this.getDomainStatus(ReadinessDomain.GHL_TRUST);
  }

  /**
   * Get voice risk signals domain status
   */
  async getVoiceRiskSignals(): Promise<any> {
    return this.getDomainStatus(ReadinessDomain.VOICE_RISK);
  }

  /**
   * Get billing revenue safety domain status
   */
  async getBillingRevenueSafety(): Promise<any> {
    return this.getDomainStatus(ReadinessDomain.BILLING_REVENUE);
  }
}

/**
 * Default readiness API client instance
 */
export const readinessApiClient = new ReadinessApiClient();
