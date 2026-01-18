// HTTP Retry Logic - Exponential backoff with jitter

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  jitter: boolean;
}

export interface RetryableError extends Error {
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number;
}

export class RetryError extends Error {
  constructor(
    public attempts: number,
    public lastError: Error,
    message?: string
  ) {
    super(message || `Failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryError';
  }
}

export class HttpRetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true,
      ...config,
    };
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: { correlationId?: string; operation?: string }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt > this.config.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff and optional jitter
        const delay = this.calculateDelay(attempt, error);

        console.warn(
          `HTTP operation failed (attempt ${attempt}/${this.config.maxRetries + 1}), ` +
            `retrying in ${delay}ms: ${error.message}`,
          context
        );

        await this.sleep(delay);
      }
    }

    throw new RetryError(this.config.maxRetries + 1, lastError);
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.name === 'NetworkError'
    ) {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatuses = [408, 429, 500, 502, 503, 504]; // Request Timeout, Too Many Requests, Server Errors
    if (error.statusCode && retryableStatuses.includes(error.statusCode)) {
      return true;
    }

    // Check if error explicitly marks itself as retryable
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, error?: any): number {
    let delay =
      this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt - 1);

    // Respect Retry-After header if present
    if (error?.retryAfter) {
      delay = Math.max(delay, error.retryAfter * 1000);
    }

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      delay += Math.random() * jitterRange - jitterRange / 2;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics
   */
  getStats(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
