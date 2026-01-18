/**
 * HTTP Client - WI-061: UI Infrastructure & Governance Layer
 *
 * Enhanced HTTP client with correlation ID propagation, tenant ID handling,
 * and bounded retries. Server-driven determinism.
 */

import {
  ApiResponse,
  HttpClientConfig,
  RequestOptions,
  UiSdkError,
} from '../types';

/**
 * Enhanced HTTP Client for NeuronX UI SDK
 * Handles correlation ID propagation, tenant isolation, and bounded retries
 */
export class HttpClient {
  private readonly config: HttpClientConfig;

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = {
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Make a GET request
   */
  async get<T = any>(
    endpoint: string,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(
    endpoint: string,
    options: Omit<RequestOptions, 'method'> = {}
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Core request method with retry logic and governance headers
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;

    // Ensure correlation ID is present
    const correlationId = options.correlationId || this.generateCorrelationId();

    // Prepare headers with governance requirements
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('x-correlation-id', correlationId);

    // Add tenant ID if provided
    if (options.tenantId) {
      headers.set('x-tenant-id', options.tenantId);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: this.createTimeoutSignal(),
    };

    let lastError: Error | null = null;

    // Retry logic (only for GET requests and safe errors)
    const shouldRetry = options.method === 'GET' && !options.skipRetry;
    const maxAttempts = shouldRetry ? this.config.maxRetries : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        // Extract correlation ID from response
        const responseCorrelationId =
          response.headers.get('x-correlation-id') || correlationId;

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: 'Unknown error' }));
          throw new UiSdkError(
            errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`,
            `HTTP_${response.status}`,
            responseCorrelationId
          );
        }

        const data = await response.json();
        return {
          success: true,
          data,
          correlationId: responseCorrelationId,
        };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt or if it's not a retryable error
        if (attempt === maxAttempts || !this.isRetryableError(error)) {
          break;
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError?.message || 'Network error',
      correlationId,
    };
  }

  /**
   * Create AbortSignal for request timeout
   */
  private createTimeoutSignal(): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.config.timeout);
    return controller.signal;
  }

  /**
   * Generate correlation ID for request tracing
   */
  private generateCorrelationId(): string {
    return `ui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.name === 'AbortError') return true; // Timeout
    if (error.message?.includes('Network error')) return true;
    if (error.message?.includes('fetch')) return true;

    // Check for specific HTTP status codes (would be in UiSdkError)
    const statusMatch = error.message?.match(/HTTP_(\d+):/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      return status >= 500; // 5xx errors
    }

    return false;
  }

  /**
   * Delay utility for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default HTTP client instance
 */
export const httpClient = new HttpClient();

/**
 * Create a new HTTP client with custom config
 */
export const createHttpClient = (config: Partial<HttpClientConfig>) => {
  return new HttpClient(config);
};
