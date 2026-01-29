// HTTP Circuit Breaker - Fail-fast for unhealthy services

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  recoveryTimeout: number; // Ms to wait before trying again
  monitoringPeriod: number; // Ms to track failures
  successThreshold: number; // Successes needed to close from half-open
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
}

export class CircuitOpenError extends Error {
  constructor(
    public retryAfter: number,
    message = 'Circuit breaker is open'
  ) {
    super(message);
    this.name = 'CircuitOpenError';
    this.retryable = true;
  }
  retryable: boolean = true;
}

export class HttpCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should transition states
    this.updateState();

    // Fail fast if circuit is open
    if (this.state === 'OPEN') {
      throw new CircuitOpenError(
        this.nextAttemptTime
          ? this.nextAttemptTime - Date.now()
          : this.config.recoveryTimeout
      );
    }

    try {
      const result = await operation();

      // Record success
      this.onSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    // If in half-open state and we've hit success threshold, close circuit
    if (
      this.state === 'HALF_OPEN' &&
      this.successes >= this.config.successThreshold
    ) {
      this.closeCircuit();
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    // If we've exceeded failure threshold, open circuit
    if (
      this.state === 'CLOSED' &&
      this.failures >= this.config.failureThreshold
    ) {
      this.openCircuit();
    } else if (this.state === 'HALF_OPEN') {
      // Single failure in half-open state re-opens circuit
      this.openCircuit();
    }
  }

  /**
   * Update circuit state based on time and conditions
   */
  private updateState(): void {
    const now = Date.now();

    // If circuit is open and recovery timeout has passed, go to half-open
    if (
      this.state === 'OPEN' &&
      this.nextAttemptTime &&
      now >= this.nextAttemptTime
    ) {
      this.state = 'HALF_OPEN';
      this.successes = 0; // Reset success counter for half-open state
    }

    // Reset failure counter if we're outside the monitoring period
    if (
      this.state === 'CLOSED' &&
      this.lastFailureTime &&
      now - this.lastFailureTime > this.config.monitoringPeriod
    ) {
      this.failures = 0;
    }
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
  }

  /**
   * Close the circuit
   */
  private closeCircuit(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttemptTime = undefined;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * Manually trip the circuit breaker (for testing/emergency)
   */
  trip(): void {
    this.openCircuit();
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.closeCircuit();
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if circuit breaker would allow a request
   */
  canExecute(): boolean {
    this.updateState();
    return this.state !== 'OPEN';
  }

  /**
   * Get failure rate over monitoring period
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) return 0;

    const now = Date.now();
    const periodStart = now - this.config.monitoringPeriod;

    // Count failures in monitoring period
    let periodFailures = 0;
    let periodRequests = 0;

    // Simplified: assume all recent requests are in monitoring period
    // In production, you'd track timestamps for each request
    if (this.lastFailureTime && this.lastFailureTime >= periodStart) {
      periodFailures = this.failures;
      periodRequests = this.totalRequests;
    }

    return periodRequests > 0 ? periodFailures / periodRequests : 0;
  }
}
