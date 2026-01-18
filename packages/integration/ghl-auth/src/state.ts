// OAuth State Management - CSRF Protection and State Validation

export interface OAuthStateData {
  tenantId: string;
  agencyEnv: 'dev' | 'stage' | 'prod';
  nonce: string;
  issuedAt: Date;
  scopes: string[];
  redirectUrl?: string;
}

export class OAuthStateManager {
  private states = new Map<string, OAuthStateData>();
  private readonly maxAge = 5 * 60 * 1000; // 5 minutes

  /**
   * Create and store OAuth state
   */
  createState(data: Omit<OAuthStateData, 'nonce' | 'issuedAt'>): string {
    const stateData: OAuthStateData = {
      ...data,
      nonce: this.generateNonce(),
      issuedAt: new Date(),
    };

    // Generate unique state identifier
    const stateId = this.generateStateId();

    // Store state (with TTL)
    this.states.set(stateId, stateData);

    // Clean up expired states
    this.cleanupExpiredStates();

    return stateId;
  }

  /**
   * Validate and retrieve OAuth state
   */
  validateState(stateId: string): OAuthStateData | null {
    const stateData = this.states.get(stateId);

    if (!stateData) {
      return null;
    }

    // Check expiration
    if (this.isExpired(stateData.issuedAt)) {
      this.states.delete(stateId);
      return null;
    }

    // Single use - delete after validation
    this.states.delete(stateId);

    return stateData;
  }

  /**
   * Get state data without consuming it (for debugging)
   */
  peekState(stateId: string): OAuthStateData | null {
    const stateData = this.states.get(stateId);

    if (!stateData || this.isExpired(stateData.issuedAt)) {
      return null;
    }

    return stateData;
  }

  /**
   * Clean up expired states
   */
  cleanupExpiredStates(): void {
    const now = Date.now();

    for (const [stateId, stateData] of this.states.entries()) {
      if (now - stateData.issuedAt.getTime() > this.maxAge) {
        this.states.delete(stateId);
      }
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    activeStates: number;
    averageAge: number;
    oldestState?: Date;
  } {
    if (this.states.size === 0) {
      return { activeStates: 0, averageAge: 0 };
    }

    const now = Date.now();
    let totalAge = 0;
    let oldestAge = 0;

    for (const stateData of this.states.values()) {
      const age = now - stateData.issuedAt.getTime();
      totalAge += age;
      oldestAge = Math.max(oldestAge, age);
    }

    return {
      activeStates: this.states.size,
      averageAge: totalAge / this.states.size,
      oldestState: oldestAge > 0 ? new Date(now - oldestAge) : undefined,
    };
  }

  private generateNonce(): string {
    return Buffer.from(Math.random().toString())
      .toString('base64')
      .slice(0, 16);
  }

  private generateStateId(): string {
    return `oauth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isExpired(issuedAt: Date): boolean {
    return Date.now() - issuedAt.getTime() > this.maxAge;
  }
}
