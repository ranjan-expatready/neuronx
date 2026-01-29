// HTTP Rate Limiting - Token bucket algorithm

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit?: number; // Allow bursting above the rate
  queueSize?: number; // Max queued requests
}

export interface RateLimitStats {
  currentTokens: number;
  queuedRequests: number;
  totalRequests: number;
  throttledRequests: number;
  averageWaitTime: number;
}

export class RateLimitExceededError extends Error {
  constructor(
    public retryAfter: number,
    message = 'Rate limit exceeded'
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.retryable = true;
  }
  retryable: boolean = true;
}

export class HttpRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private requestQueue: Array<{
    resolve: (value: void) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private stats: RateLimitStats;

  constructor(private config: RateLimitConfig) {
    this.tokens = config.requestsPerMinute;
    this.lastRefill = Date.now();
    this.stats = {
      currentTokens: this.tokens,
      queuedRequests: 0,
      totalRequests: 0,
      throttledRequests: 0,
      averageWaitTime: 0,
    };
  }

  /**
   * Acquire permission to make a request
   */
  async acquire(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stats.totalRequests++;

      // Refill tokens based on elapsed time
      this.refillTokens();

      // If we have tokens available, use one
      if (this.tokens > 0) {
        this.tokens--;
        this.stats.currentTokens = this.tokens;
        resolve();
        return;
      }

      // Check burst allowance
      const burstAllowance = this.config.burstLimit || 0;
      if (this.tokens + burstAllowance > 0) {
        this.tokens--;
        this.stats.currentTokens = this.tokens;
        resolve();
        return;
      }

      // Queue the request if under limit
      if (
        this.config.queueSize &&
        this.requestQueue.length < this.config.queueSize
      ) {
        const request = {
          resolve,
          reject,
          timestamp: Date.now(),
        };

        this.requestQueue.push(request);
        this.stats.queuedRequests = this.requestQueue.length;

        // Set a timeout to prevent indefinite queuing
        setTimeout(() => {
          const index = this.requestQueue.indexOf(request);
          if (index > -1) {
            this.requestQueue.splice(index, 1);
            this.stats.queuedRequests = this.requestQueue.length;
            this.stats.throttledRequests++;
            reject(
              new RateLimitExceededError(60000, 'Request queued too long')
            );
          }
        }, 30000); // 30 second timeout
      } else {
        // Reject immediately if queue is full
        this.stats.throttledRequests++;
        reject(
          new RateLimitExceededError(60000, 'Rate limit exceeded, queue full')
        );
      }
    });
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const elapsedMinutes = elapsedMs / (60 * 1000);

    // Calculate tokens to add
    const tokensToAdd = Math.floor(
      elapsedMinutes * this.config.requestsPerMinute
    );

    if (tokensToAdd > 0) {
      this.tokens = Math.min(
        this.config.requestsPerMinute + (this.config.burstLimit || 0),
        this.tokens + tokensToAdd
      );

      this.lastRefill = now;
      this.stats.currentTokens = this.tokens;

      // Process queued requests
      this.processQueue();
    }
  }

  /**
   * Process queued requests when tokens become available
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0 && this.tokens > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        this.tokens--;
        this.stats.currentTokens = this.tokens;
        this.stats.queuedRequests = this.requestQueue.length;

        // Calculate wait time for stats
        const waitTime = Date.now() - request.timestamp;
        this.updateAverageWaitTime(waitTime);

        request.resolve();
      }
    }
  }

  /**
   * Update rolling average wait time
   */
  private updateAverageWaitTime(waitTime: number): void {
    const alpha = 0.1; // Smoothing factor
    this.stats.averageWaitTime =
      alpha * waitTime + (1 - alpha) * this.stats.averageWaitTime;
  }

  /**
   * Get current rate limit statistics
   */
  getStats(): RateLimitStats {
    // Update current token count
    this.refillTokens();

    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.queuedRequests = this.requestQueue.length;
    this.stats.totalRequests = 0;
    this.stats.throttledRequests = 0;
    this.stats.averageWaitTime = 0;
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reset tokens if rate changed
    if (newConfig.requestsPerMinute) {
      this.tokens = Math.min(this.tokens, newConfig.requestsPerMinute);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Emergency drain - release all queued requests
   */
  drainQueue(): number {
    const drainedCount = this.requestQueue.length;

    for (const request of this.requestQueue) {
      request.reject(new Error('Rate limiter drained'));
    }

    this.requestQueue = [];
    this.stats.queuedRequests = 0;

    return drainedCount;
  }
}
