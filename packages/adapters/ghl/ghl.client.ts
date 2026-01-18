// GHL API Client - Production HTTP infrastructure
// Uses hardened HTTP client with retry, rate limiting, and circuit breaker

import { HttpClient, HttpClientError } from '@neuronx/http';
import { GhlApiResponse, GhlApiError, GhlTokenResponse } from './ghl.types';

export interface GhlClientConfig {
  baseUrl: string;
  token: string;
  version?: string;
  // HTTP client configuration
  httpConfig?: {
    timeout?: number;
    retry?: any;
    rateLimit?: any;
    circuitBreaker?: any;
  };
}

export class GhlClient {
  private httpClient: HttpClient;
  private version: string;

  constructor(config: GhlClientConfig) {
    this.version = config.version || '2021-04-15';

    // Initialize HTTP client with resilience features
    this.httpClient = new HttpClient({
      baseUrl: config.baseUrl,
      timeout: 30000, // 30 seconds
      retry: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        jitter: true,
      },
      rateLimit: {
        requestsPerMinute: 100,
        burstLimit: 20,
        queueSize: 50,
      },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 60000,
        successThreshold: 2,
      },
      ...config.httpConfig,
    });
  }

  // Update token (for refresh scenarios)
  updateToken(token: string): void {
    // Note: In this architecture, token management is handled by the TokenVault
    // This method is kept for compatibility but token should come from vault
    console.warn(
      'GhlClient.updateToken() called - tokens should be managed by TokenVault'
    );
  }

  // Core HTTP methods using resilient HttpClient
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: {
      token: string; // Token must be provided per request
      body?: any;
      params?: Record<string, any>;
      locationId?: string;
      correlationId?: string;
      tenantId?: string;
    }
  ): Promise<T> {
    const params = { ...options.params };
    if (options.locationId) {
      params.locationId = options.locationId;
    }

    try {
      const response = await this.httpClient.request(
        {
          method,
          url: path,
          headers: {
            Authorization: `Bearer ${options.token}`,
            Version: this.version,
          },
          body: options.body,
          params,
        },
        {
          correlationId: options.correlationId,
          tenantId: options.tenantId,
          operation: `${method} ${path}`,
        }
      );

      return response.data;
    } catch (error) {
      if (error instanceof HttpClientError) {
        throw new GhlApiError(
          `GHL API Error: ${error.statusCode} ${error.message}`,
          error.statusCode,
          error.response
        );
      }
      throw error;
    }
  }

  // Contacts API
  async getContacts(
    token: string,
    params?: {
      locationId?: string;
      limit?: number;
      offset?: number;
      email?: string;
      phone?: string;
    },
    context?: { correlationId?: string; tenantId?: string }
  ): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/contacts', {
      token,
      params,
      correlationId: context?.correlationId,
      tenantId: context?.tenantId,
    });
  }

  async getContact(
    token: string,
    id: string,
    context?: { correlationId?: string; tenantId?: string }
  ): Promise<any> {
    return this.request('GET', `/contacts/${id}`, {
      token,
      correlationId: context?.correlationId,
      tenantId: context?.tenantId,
    });
  }

  async createContact(
    token: string,
    data: any,
    locationId: string,
    context?: { correlationId?: string; tenantId?: string }
  ): Promise<any> {
    return this.request('POST', '/contacts', {
      token,
      body: data,
      locationId,
      correlationId: context?.correlationId,
      tenantId: context?.tenantId,
    });
  }

  async updateContact(id: string, data: any): Promise<any> {
    return this.request('PUT', `/contacts/${id}`, { body: data });
  }

  async deleteContact(id: string): Promise<void> {
    return this.request('DELETE', `/contacts/${id}`);
  }

  // Opportunities API
  async getOpportunities(params?: {
    locationId?: string;
    pipelineId?: string;
    limit?: number;
    offset?: number;
  }): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/opportunities', { params });
  }

  async getOpportunity(id: string): Promise<any> {
    return this.request('GET', `/opportunities/${id}`);
  }

  async createOpportunity(data: any, locationId: string): Promise<any> {
    return this.request('POST', '/opportunities', {
      body: data,
      locationId,
    });
  }

  async updateOpportunity(id: string, data: any): Promise<any> {
    return this.request('PUT', `/opportunities/${id}`, { body: data });
  }

  async deleteOpportunity(id: string): Promise<void> {
    return this.request('DELETE', `/opportunities/${id}`);
  }

  // Pipelines API
  async getPipelines(locationId: string): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/pipelines', { params: { locationId } });
  }

  async getPipeline(id: string): Promise<any> {
    return this.request('GET', `/pipelines/${id}`);
  }

  // Conversations API
  async getConversations(params?: {
    locationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/conversations', { params });
  }

  async getConversation(id: string): Promise<any> {
    return this.request('GET', `/conversations/${id}`);
  }

  async getConversationMessages(
    conversationId: string,
    params?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<GhlApiResponse<any>> {
    return this.request('GET', `/conversations/${conversationId}/messages`, {
      params,
    });
  }

  async sendMessage(conversationId: string, data: any): Promise<any> {
    return this.request('POST', `/conversations/${conversationId}/messages`, {
      body: data,
    });
  }

  async updateConversation(id: string, data: any): Promise<any> {
    return this.request('PUT', `/conversations/${id}`, { body: data });
  }

  // Workflows API
  async getWorkflows(params?: {
    locationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/workflows', { params });
  }

  async getWorkflow(id: string): Promise<any> {
    return this.request('GET', `/workflows/${id}`);
  }

  async triggerWorkflow(workflowId: string, data: any): Promise<any> {
    return this.request('POST', `/workflows/${workflowId}/trigger`, {
      body: data,
    });
  }

  async pauseWorkflow(executionId: string): Promise<any> {
    return this.request('POST', `/workflows/executions/${executionId}/pause`);
  }

  async resumeWorkflow(executionId: string): Promise<any> {
    return this.request('POST', `/workflows/executions/${executionId}/resume`);
  }

  async cancelWorkflow(executionId: string): Promise<any> {
    return this.request('POST', `/workflows/executions/${executionId}/cancel`);
  }

  async getWorkflowExecution(executionId: string): Promise<any> {
    return this.request('GET', `/workflows/executions/${executionId}`);
  }

  // Users API
  async getUsers(params?: {
    companyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/users', { params });
  }

  async getUser(id: string): Promise<any> {
    return this.request('GET', `/users/${id}`);
  }

  // Calendar API
  async getCalendarEvents(params?: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<GhlApiResponse<any>> {
    return this.request('GET', '/calendars/events', { params });
  }

  async getCalendarEvent(id: string): Promise<any> {
    return this.request('GET', `/calendars/events/${id}`);
  }

  async createCalendarEvent(data: any, locationId: string): Promise<any> {
    return this.request('POST', '/calendars/events', {
      body: data,
      locationId,
    });
  }

  async updateCalendarEvent(id: string, data: any): Promise<any> {
    return this.request('PUT', `/calendars/events/${id}`, { body: data });
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    return this.request('DELETE', `/calendars/events/${id}`);
  }

  // OAuth token endpoints (for refresh)
  static async refreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<GhlTokenResponse> {
    const response = await fetch(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!response.ok) {
      throw new GhlApiError(
        `Token refresh failed: ${response.status}`,
        response.status
      );
    }

    return response.json();
  }
}

// Custom error class for GHL API errors
export class GhlApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any
  ) {
    super(message);
    this.name = 'GhlApiError';
  }
}
