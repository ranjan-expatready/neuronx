/**
 * Correlation ID Utilities - WI-061: UI Infrastructure & Governance Layer
 *
 * Correlation ID generation and propagation for end-to-end request tracing
 */

/**
 * Generate a unique correlation ID for request tracing
 */
export const generateCorrelationId = (): string => {
  return `ui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Correlation context for managing request chains
 */
export class CorrelationContext {
  private static currentId: string | null = null;

  /**
   * Get the current correlation ID, or generate a new one
   */
  static get(): string {
    if (!this.currentId) {
      this.currentId = generateCorrelationId();
    }
    return this.currentId;
  }

  /**
   * Set the correlation ID for the current context
   */
  static set(correlationId: string): void {
    this.currentId = correlationId;
  }

  /**
   * Clear the current correlation ID
   */
  static clear(): void {
    this.currentId = null;
  }

  /**
   * Run a function with a specific correlation ID
   */
  static async withCorrelationId<T>(
    correlationId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const previousId = this.currentId;
    try {
      this.set(correlationId);
      return await fn();
    } finally {
      this.currentId = previousId;
    }
  }

  /**
   * Create a child correlation ID for sub-operations
   */
  static createChildId(parentId?: string): string {
    const baseId = parentId || this.get();
    return `${baseId}_${Date.now()}`;
  }
}

/**
 * Correlation-aware operation wrapper
 */
export const withCorrelation = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    const correlationId = CorrelationContext.get();
    try {
      return await fn(...args);
    } catch (error) {
      // Log correlation ID with error for debugging
      console.error(`Operation failed`, {
        correlationId,
        error: (error as Error).message,
      });
      throw error;
    }
  };
};
