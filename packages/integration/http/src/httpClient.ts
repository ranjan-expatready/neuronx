// Production HTTP Client - Combines retry, rate limiting, and circuit breaker

import { HttpRetryHandler } from './retry';
import { HttpRateLimiter } from './rateLimiter';
import { HttpCircuitBreaker } from './circuitBreaker';

export interface HttpClientConfig {
  baseUrl?: string;
  timeout?: number;
  retry?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    jitter?: boolean;
  };
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit?: number;
    queueSize?: number;
  };
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    monitoringPeriod?: number;
    successThreshold?: number;
  };
}

export interface HttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  duration: number;
}

export interface HttpClientStats {
  retry: ReturnType<HttpRetryHandler['getStats']>;
  rateLimit: ReturnType<HttpRateLimiter['getStats']>;
  circuitBreaker: ReturnType<HttpCircuitBreaker['getStats']>;
}

export class HttpClientError extends Error {
  constructor(
    public statusCode: number,
    public response?: any,
    public retryable: boolean = false,
    message?: string
  ) {
    super(message || `HTTP ${statusCode} error`);
    this.name = 'HttpClientError';
  }
}

export class HttpClient {
  private retryHandler: HttpRetryHandler;
  private rateLimiter?: HttpRateLimiter;
  private circuitBreaker?: HttpCircuitBreaker;
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(config: HttpClientConfig = {}) {
    this.baseUrl = config.baseUrl || '';
    this.defaultTimeout = config.timeout || 30000; // 30 seconds

    // Initialize components
    this.retryHandler = new HttpRetryHandler(config.retry);

    if (config.rateLimit) {
      this.rateLimiter = new HttpRateLimiter(config.rateLimit);
    }

    if (config.circuitBreaker) {
      this.circuitBreaker = new HttpCircuitBreaker(config.circuitBreaker);
    }
  }

  /**
   * Execute HTTP request with full resilience
   */
  async request<T = any>(
    request: HttpRequest,
    context?: { correlationId?: string; tenantId?: string; operation?: string }
  ): Promise<HttpResponse<T>> {
    const startTime = Date.now();

    try {
      // Apply rate limiting if configured
      if (this.rateLimiter) {
        await this.rateLimiter.acquire();
      }

      // Execute through circuit breaker if configured
      if (this.circuitBreaker) {
        return await this.circuitBreaker.execute(() =>
          this.executeRequest(request, context)
        );
      } else {
        return await this.executeRequest(request, context);
      }
    } catch (error) {
      // Log failure for observability
      console.error('HTTP request failed:', {
        method: request.method,
        url: request.url,
        error: error.message,
        correlationId: context?.correlationId,
        tenantId: context?.tenantId,
        operation: context?.operation,
        duration: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Execute the actual HTTP request with retry logic
   */
  private async executeRequest<T>(
    request: HttpRequest,
    context?: { correlationId?: string; tenantId?: string; operation?: string }
  ): Promise<HttpResponse<T>> {
    const startTime = Date.now();

    return await this.retryHandler.executeWithRetry(async () => {
      const fullUrl = this.buildUrl(request.url, request.params);
      const timeout = request.timeout || this.defaultTimeout;

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const fetchOptions: RequestInit = {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'NeuronX/1.0',
            ...request.headers,
          },
          signal: controller.signal,
        };

        // Add body for non-GET requests
        if (request.body && request.method !== 'GET') {
          fetchOptions.body =
            typeof request.body === 'string'
              ? request.body
              : JSON.stringify(request.body);
        }

        const response = await fetch(fullUrl, fetchOptions);
        const responseTime = Date.now() - startTime;

        // Clear timeout
        clearTimeout(timeoutId);

        // Handle non-2xx responses
        if (!response.ok) {
          const errorBody = await response.text();
          let parsedError: any;

          try {
            parsedError = JSON.parse(errorBody);
          } catch {
            parsedError = { message: errorBody };
          }

          const httpError = new HttpClientError(
            response.status,
            parsedError,
            this.isRetryableStatus(response.status),
            `${request.method} ${fullUrl} failed: ${response.status} ${response.statusText}`
          );

          // Add retry-after header if present
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            (httpError as any).retryAfter = parseInt(retryAfter) * 1000;
          }

          throw httpError;
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        let data: T;

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as unknown as T;
        }

        // Log success for observability
        console.log('HTTP request successful:', {
          method: request.method,
          url: fullUrl,
          status: response.status,
          correlationId: context?.correlationId,
          tenantId: context?.tenantId,
          operation: context?.operation,
          duration: responseTime,
        });

        return {
          status: response.status,
          statusText: response.statusText,
          headers: this.headersToObject(response.headers),
          data,
          duration: responseTime,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle fetch errors (network, timeout, etc.)
        if (error.name === 'AbortError') {
          throw new HttpClientError(
            408,
            undefined,
            true,
            `Request timeout after ${timeout}ms`
          );
        }

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new HttpClientError(
            0,
            undefined,
            true,
            'Network error: ' + error.message
          );
        }

        // Re-throw HttpClientError as-is
        if (error instanceof HttpClientError) {
          throw error;
        }

        // Wrap other errors
        throw new HttpClientError(
          0,
          undefined,
          true,
          'Request failed: ' + error.message
        );
      }
    }, context);
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(url: string, params?: Record<string, any>): string {
    const fullUrl = url.startsWith('http') ? url : this.baseUrl + url;

    if (!params || Object.keys(params).length === 0) {
      return fullUrl;
    }

    const urlObj = new URL(fullUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    });

    return urlObj.toString();
  }

  /**
   * Convert Headers to plain object
   */
  private headersToObject(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Determine if HTTP status is retryable
   */
  private isRetryableStatus(status: number): boolean {
    // Retry on server errors, timeouts, and rate limits
    return status >= 500 || status === 408 || status === 429;
  }

  /**
   * Get client statistics
   */
  getStats(): HttpClientStats {
    return {
      retry: this.retryHandler.getStats(),
      rateLimit: this.rateLimiter?.getStats(),
      circuitBreaker: this.circuitBreaker?.getStats(),
    };
  }

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<HttpClientConfig>): void {
    if (config.retry) {
      this.retryHandler.updateConfig(config.retry);
    }

    if (config.rateLimit && this.rateLimiter) {
      this.rateLimiter.updateConfig(config.rateLimit);
    }

    if (config.circuitBreaker && this.circuitBreaker) {
      this.circuitBreaker.updateConfig(config.circuitBreaker);
    }

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }

    if (config.timeout) {
      this.defaultTimeout = config.timeout;
    }
  }

  /**
   * Emergency controls
   */
  emergencyStop(): void {
    this.circuitBreaker?.trip();
  }

  emergencyReset(): void {
    this.circuitBreaker?.reset();
    this.rateLimiter?.resetStats();
  }
}
