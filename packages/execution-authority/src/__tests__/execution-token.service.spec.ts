/**
 * Execution Token Service Tests - WI-034: Multi-Channel Execution Authority
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExecutionTokenService,
  TokenRepository,
} from '../execution-token.service';
import { ExecutionPlan } from '../types';

// Mock repository
const mockRepository: TokenRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByCorrelationId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findExpired: vi.fn(),
};

describe('ExecutionTokenService', () => {
  let tokenService: ExecutionTokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenService = new ExecutionTokenService(mockRepository, 10);
  });

  describe('issueToken', () => {
    const mockPlan: ExecutionPlan = {
      allowed: true,
      reason: 'Test execution',
      actor: 'AI',
      mode: 'AUTONOMOUS',
      channel: 'voice',
      adapterCommand: {
        commandId: 'cmd_1',
        commandType: 'EXECUTE_CONTACT',
        channelData: {},
      },
      constraints: {},
      correlationId: 'corr_1',
      auditReason: 'Test audit',
      riskAssessment: {
        level: 'low',
        score: 20,
        factors: [],
        mitigationStrategies: [],
      },
    };

    it('should issue token for valid plan', async () => {
      const mockToken = {
        tokenId: 'token_123',
        tenantId: 'tenant_1',
        opportunityId: 'opp_1',
        actorType: 'AI',
        mode: 'AUTONOMOUS',
        channelScope: 'voice',
        commandType: 'EXECUTE_CONTACT',
        correlationId: 'corr_1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
        createdBy: 'system',
      };

      mockRepository.create.mockResolvedValue(mockToken);

      const result = await tokenService.issueToken(mockPlan, 'system');

      expect(result).toEqual(mockToken);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_1',
          opportunityId: 'opp_1',
          actorType: 'AI',
          channelScope: 'voice',
          commandType: 'EXECUTE_CONTACT',
        })
      );
    });

    it('should reject token issuance for disallowed plan', async () => {
      const disallowedPlan = { ...mockPlan, allowed: false };

      await expect(
        tokenService.issueToken(disallowedPlan, 'system')
      ).rejects.toThrow('Cannot issue token for disallowed execution plan');
    });

    it('should reject token issuance for plan without token requirement', async () => {
      const planWithoutToken = { ...mockPlan };
      delete (planWithoutToken as any).token;

      await expect(
        tokenService.issueToken(planWithoutToken, 'system')
      ).rejects.toThrow('Execution plan does not require a token');
    });
  });

  describe('verifyToken', () => {
    const mockToken = {
      tokenId: 'token_123',
      tenantId: 'tenant_1',
      opportunityId: 'opp_1',
      actorType: 'AI',
      mode: 'AUTONOMOUS',
      channelScope: 'voice',
      commandType: 'EXECUTE_CONTACT',
      correlationId: 'corr_1',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
      usedAt: null,
      revokedAt: null,
    };

    it('should verify valid token with correct scope', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      const result = await tokenService.verifyToken('token_123', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result.valid).toBe(true);
      expect(result.canUse).toBe(true);
      expect(result.token).toEqual(mockToken);
    });

    it('should reject token not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await tokenService.verifyToken('invalid_token', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result.valid).toBe(false);
      expect(result.canUse).toBe(false);
      expect(result.reason).toContain('Token not found');
    });

    it('should reject expired token', async () => {
      const expiredToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockRepository.findById.mockResolvedValue(expiredToken);

      const result = await tokenService.verifyToken('token_123', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result.valid).toBe(true);
      expect(result.canUse).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should reject used token', async () => {
      const usedToken = {
        ...mockToken,
        usedAt: new Date(),
      };
      mockRepository.findById.mockResolvedValue(usedToken);

      const result = await tokenService.verifyToken('token_123', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result.canUse).toBe(false);
      expect(result.reason).toContain('already been used');
    });

    it('should reject revoked token', async () => {
      const revokedToken = {
        ...mockToken,
        revokedAt: new Date(),
      };
      mockRepository.findById.mockResolvedValue(revokedToken);

      const result = await tokenService.verifyToken('token_123', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result.canUse).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('should reject token with wrong channel scope', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      const result = await tokenService.verifyToken('token_123', {
        channel: 'email', // Wrong channel
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result.canUse).toBe(false);
      expect(result.reason).toContain('channel scope mismatch');
    });

    it('should reject token with wrong command type', async () => {
      mockRepository.findById.mockResolvedValue(mockToken);

      const result = await tokenService.verifyToken('token_123', {
        channel: 'voice',
        commandType: 'SEND_MESSAGE', // Wrong command type
      });

      expect(result.canUse).toBe(false);
      expect(result.reason).toContain('command type mismatch');
    });
  });

  describe('markTokenUsed', () => {
    it('should mark valid token as used', async () => {
      const mockToken = {
        tokenId: 'token_123',
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10000),
      };

      mockRepository.findById.mockResolvedValue(mockToken);

      await tokenService.markTokenUsed('token_123', 'test_user');

      expect(mockRepository.update).toHaveBeenCalledWith('token_123', {
        usedAt: expect.any(Date),
        usedBy: 'test_user',
      });
    });

    it('should be idempotent for already used tokens', async () => {
      const mockToken = {
        tokenId: 'token_123',
        usedAt: new Date(),
        usedBy: 'existing_user',
      };

      mockRepository.findById.mockResolvedValue(mockToken);

      await expect(
        tokenService.markTokenUsed('token_123', 'test_user')
      ).resolves.not.toThrow();

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should reject revoked tokens', async () => {
      const mockToken = {
        tokenId: 'token_123',
        revokedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockToken);

      await expect(
        tokenService.markTokenUsed('token_123', 'test_user')
      ).rejects.toThrow('Cannot use revoked token');
    });
  });

  describe('executionRequiresToken', () => {
    it('should require token for side-effect commands', () => {
      const planWithSideEffect: ExecutionPlan = {
        allowed: true,
        reason: 'Test',
        actor: 'AI',
        mode: 'AUTONOMOUS',
        channel: 'voice',
        adapterCommand: {
          commandId: 'cmd_1',
          commandType: 'EXECUTE_CONTACT',
          channelData: {},
        },
        constraints: {},
        correlationId: 'corr_1',
        auditReason: 'Test',
        riskAssessment: {
          level: 'low',
          score: 0,
          factors: [],
          mitigationStrategies: [],
        },
      };

      const requiresToken =
        tokenService.executionRequiresToken(planWithSideEffect);
      expect(requiresToken).toBe(true);
    });

    it('should not require token for read-only commands', () => {
      const planReadOnly: ExecutionPlan = {
        allowed: true,
        reason: 'Test',
        actor: 'AI',
        mode: 'AUTONOMOUS',
        channel: 'email',
        adapterCommand: {
          commandId: 'cmd_1',
          commandType: 'READ_DATA',
          channelData: {},
        },
        constraints: {},
        correlationId: 'corr_1',
        auditReason: 'Test',
        riskAssessment: {
          level: 'low',
          score: 0,
          factors: [],
          mitigationStrategies: [],
        },
      };

      const requiresToken = tokenService.executionRequiresToken(planReadOnly);
      expect(requiresToken).toBe(false);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired unused tokens', async () => {
      const expiredTokens = [
        { tokenId: 'token_1', usedAt: null, revokedAt: null },
        { tokenId: 'token_2', usedAt: new Date(), revokedAt: null }, // Used, should not be deleted
      ];

      mockRepository.findExpired.mockResolvedValue(expiredTokens as any);

      const cleanedCount = await tokenService.cleanupExpiredTokens();

      expect(cleanedCount).toBe(1);
      expect(mockRepository.delete).toHaveBeenCalledWith('token_1');
      expect(mockRepository.delete).not.toHaveBeenCalledWith('token_2');
    });
  });
});
