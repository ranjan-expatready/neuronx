/**
 * Execution Token Service - WI-034: Multi-Channel Execution Authority
 *
 * Secure token lifecycle management for execution side effects (REQ-016).
 */

import { randomBytes } from 'crypto';
import {
  ExecutionToken,
  TokenVerificationResult,
  ExecutionPlan,
  ExecutionChannel,
} from './types';
import { ExecutionCommand } from '@neuronx/playbook-engine';

/**
 * Token repository interface (to be implemented with Prisma)
 */
export interface TokenRepository {
  create(token: Omit<ExecutionToken, 'tokenId'>): Promise<ExecutionToken>;
  findById(tokenId: string): Promise<ExecutionToken | null>;
  findByCorrelationId(correlationId: string): Promise<ExecutionToken[]>;
  update(
    tokenId: string,
    updates: Partial<ExecutionToken>
  ): Promise<ExecutionToken>;
  delete(tokenId: string): Promise<void>;
  findExpired(): Promise<ExecutionToken[]>;
}

/**
 * Execution token service with secure lifecycle management
 */
export class ExecutionTokenService {
  private repository: TokenRepository;
  private defaultExpiryMinutes: number;

  constructor(repository: TokenRepository, defaultExpiryMinutes = 10) {
    this.repository = repository;
    this.defaultExpiryMinutes = defaultExpiryMinutes;
  }

  /**
   * Generate secure random token ID
   */
  private generateTokenId(): string {
    // 32 bytes = 256 bits of entropy, URL-safe base64
    return randomBytes(32).toString('base64url');
  }

  /**
   * Issue execution token for approved plan
   */
  async issueToken(
    plan: ExecutionPlan,
    issuedBy: string
  ): Promise<ExecutionToken> {
    if (!plan.allowed) {
      throw new Error('Cannot issue token for disallowed execution plan');
    }

    if (!plan.token) {
      throw new Error('Execution plan does not require a token');
    }

    const tokenData = plan.token;
    const token: Omit<ExecutionToken, 'tokenId'> = {
      ...tokenData,
      tokenId: this.generateTokenId(),
      createdBy: issuedBy,
      createdAt: new Date(),
      expiresAt:
        tokenData.expiresAt ||
        new Date(Date.now() + this.defaultExpiryMinutes * 60 * 1000),
    };

    return this.repository.create(token);
  }

  /**
   * Verify token for execution
   */
  async verifyToken(
    tokenId: string,
    requiredScope: {
      channel: ExecutionChannel;
      commandType: ExecutionCommand['commandType'];
    }
  ): Promise<TokenVerificationResult> {
    try {
      const token = await this.repository.findById(tokenId);

      if (!token) {
        return {
          valid: false,
          reason: 'Token not found',
          canUse: false,
        };
      }

      // Check expiry
      if (token.expiresAt < new Date()) {
        return {
          valid: true,
          token,
          reason: 'Token has expired',
          canUse: false,
        };
      }

      // Check if already used
      if (token.usedAt) {
        return {
          valid: true,
          token,
          reason: 'Token has already been used',
          canUse: false,
        };
      }

      // Check if revoked
      if (token.revokedAt) {
        return {
          valid: true,
          token,
          reason: 'Token has been revoked',
          canUse: false,
        };
      }

      // Check scope matches
      if (token.channelScope !== requiredScope.channel) {
        return {
          valid: true,
          token,
          reason: `Token scope mismatch: requires ${requiredScope.channel}, token allows ${token.channelScope}`,
          canUse: false,
        };
      }

      if (token.commandType !== requiredScope.commandType) {
        return {
          valid: true,
          token,
          reason: `Command type mismatch: requires ${requiredScope.commandType}, token allows ${token.commandType}`,
          canUse: false,
        };
      }

      return {
        valid: true,
        token,
        reason: 'Token is valid and can be used',
        canUse: true,
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Token verification failed: ${error.message}`,
        canUse: false,
      };
    }
  }

  /**
   * Mark token as used (idempotent operation)
   */
  async markTokenUsed(tokenId: string, usedBy: string): Promise<void> {
    const token = await this.repository.findById(tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    if (token.usedAt) {
      // Already used - idempotent success
      return;
    }

    if (token.revokedAt) {
      throw new Error('Cannot use revoked token');
    }

    if (token.expiresAt < new Date()) {
      throw new Error('Cannot use expired token');
    }

    await this.repository.update(tokenId, {
      usedAt: new Date(),
      usedBy,
    });
  }

  /**
   * Revoke execution token (emergency control)
   */
  async revokeToken(
    tokenId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const token = await this.repository.findById(tokenId);
    if (!token) {
      throw new Error('Token not found');
    }

    if (token.revokedAt) {
      // Already revoked - idempotent
      return;
    }

    await this.repository.update(tokenId, {
      revokedAt: new Date(),
      revokedBy,
      metadata: {
        ...token.metadata,
        revocationReason: reason,
      },
    });
  }

  /**
   * Get token by ID
   */
  async getToken(tokenId: string): Promise<ExecutionToken | null> {
    return this.repository.findById(tokenId);
  }

  /**
   * Get tokens by correlation ID
   */
  async getTokensByCorrelationId(
    correlationId: string
  ): Promise<ExecutionToken[]> {
    return this.repository.findByCorrelationId(correlationId);
  }

  /**
   * Clean up expired tokens (maintenance operation)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const expiredTokens = await this.repository.findExpired();
    let cleanedCount = 0;

    for (const token of expiredTokens) {
      // Only delete if not used and not revoked (keep audit trail)
      if (!token.usedAt && !token.revokedAt) {
        await this.repository.delete(token.tokenId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    total: number;
    active: number;
    used: number;
    expired: number;
    revoked: number;
  }> {
    // This would be implemented with repository queries
    // For now, return placeholder
    return {
      total: 0,
      active: 0,
      used: 0,
      expired: 0,
      revoked: 0,
    };
  }

  /**
   * Validate token format (without database lookup)
   */
  validateTokenFormat(tokenId: string): boolean {
    // Check basic format - should be URL-safe base64
    if (!tokenId || tokenId.length < 32) {
      return false;
    }

    // Check for valid base64url characters
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    return base64UrlRegex.test(tokenId);
  }

  /**
   * Check if execution requires token
   */
  executionRequiresToken(plan: ExecutionPlan): boolean {
    // Require token for any side effect that could be abused
    const sideEffectCommands = [
      'EXECUTE_CONTACT',
      'SEND_MESSAGE',
      'SCHEDULE_MEETING',
    ];

    return sideEffectCommands.includes(plan.adapterCommand.commandType);
  }

  /**
   * Create token data for execution plan
   */
  createTokenData(
    plan: ExecutionPlan,
    tenantId: string,
    opportunityId: string,
    correlationId: string
  ): ExecutionToken | undefined {
    if (!this.executionRequiresToken(plan)) {
      return undefined;
    }

    return {
      tokenId: '', // Will be set by issueToken
      tenantId,
      opportunityId,
      actorType: plan.actor,
      mode: plan.mode,
      channelScope: plan.channel,
      commandType: plan.adapterCommand.commandType,
      correlationId,
      expiresAt: new Date(Date.now() + this.defaultExpiryMinutes * 60 * 1000),
      createdAt: new Date(),
      createdBy: 'system',
    };
  }
}
