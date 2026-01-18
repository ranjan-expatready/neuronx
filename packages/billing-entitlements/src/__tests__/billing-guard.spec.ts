/**
 * Billing Guard Tests - WI-040: Billing & Entitlements Authority
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingGuard } from '../billing-guard';
import { EntitlementEvaluator } from '../entitlement-evaluator';
import { UsageAggregator } from '../usage-aggregator';
import { EnforcementMode, UsageType } from '../types';

// Mock dependencies
vi.mock('../entitlement-evaluator');
vi.mock('../usage-aggregator');

describe('BillingGuard', () => {
  let billingGuard: BillingGuard;
  let mockEvaluator: any;
  let mockAggregator: any;

  beforeEach(() => {
    mockEvaluator = {
      checkEntitlement: vi.fn(),
    };

    mockAggregator = {
      recordUsage: vi.fn(),
    };

    billingGuard = new BillingGuard(mockEvaluator, mockAggregator);
  });

  describe('checkExecutionEntitlement', () => {
    it('should allow execution when billing allows', async () => {
      mockEvaluator.checkEntitlement.mockResolvedValue({
        allowed: true,
        reason: 'Within limits',
        currentUsage: 50,
        limit: 100,
        remainingQuota: 50,
      });

      const context = {
        tenantId: 'tenant_1',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
        },
        decisionResult: {
          voiceMode: 'SCRIPTED',
        },
        correlationId: 'corr_123',
      };

      const result = await billingGuard.checkExecutionEntitlement(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Within limits');
      expect(mockEvaluator.checkEntitlement).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        usageType: UsageType.VOICE_MINUTE,
        quantity: 2, // SCRIPTED = 2 minutes
        correlationId: 'corr_123',
      });
    });

    it('should block execution when billing blocks', async () => {
      mockEvaluator.checkEntitlement.mockResolvedValue({
        allowed: false,
        reason: 'Limit exceeded',
        currentUsage: 100,
        limit: 100,
        remainingQuota: 0,
      });

      const context = {
        tenantId: 'tenant_1',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
        },
        decisionResult: {},
        correlationId: 'corr_123',
      };

      const result = await billingGuard.checkExecutionEntitlement(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Limit exceeded');
      expect(mockEvaluator.checkEntitlement).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        usageType: UsageType.EXECUTION,
        quantity: 1, // Non-voice = 1 execution
        correlationId: 'corr_123',
      });
    });

    it('should estimate voice minutes correctly', async () => {
      mockEvaluator.checkEntitlement.mockResolvedValue({
        allowed: true,
        reason: 'Within limits',
      });

      const testCases = [
        { voiceMode: 'SCRIPTED', expectedMinutes: 2 },
        { voiceMode: 'CONVERSATIONAL', expectedMinutes: 5 },
        { voiceMode: 'HUMAN_ONLY', expectedMinutes: 10 },
        { voiceMode: undefined, expectedMinutes: 3 }, // Default
      ];

      for (const { voiceMode, expectedMinutes } of testCases) {
        const context = {
          tenantId: 'tenant_1',
          executionCommand: {
            commandType: 'EXECUTE_CONTACT',
            channel: 'voice',
          },
          decisionResult: { voiceMode },
          correlationId: 'corr_123',
        };

        await billingGuard.checkExecutionEntitlement(context);

        expect(mockEvaluator.checkEntitlement).toHaveBeenCalledWith(
          expect.objectContaining({
            usageType: UsageType.VOICE_MINUTE,
            quantity: expectedMinutes,
          })
        );
      }
    });

    it('should fail closed on billing system errors', async () => {
      mockEvaluator.checkEntitlement.mockRejectedValue(
        new Error('Database error')
      );

      const context = {
        tenantId: 'tenant_1',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
        },
        decisionResult: {},
        correlationId: 'corr_123',
      };

      const result = await billingGuard.checkExecutionEntitlement(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Billing system error');
    });
  });

  describe('recordExecutionUsage', () => {
    it('should record voice execution usage', async () => {
      const executionCommand = {
        commandType: 'EXECUTE_CONTACT',
        channel: 'voice',
      };

      const decisionResult = {
        voiceMode: 'SCRIPTED',
        actor: 'AI',
      };

      await billingGuard.recordExecutionUsage(
        'tenant_1',
        executionCommand,
        decisionResult,
        'corr_123'
      );

      expect(mockAggregator.recordUsage).toHaveBeenCalledWith({
        eventId: 'exec_corr_123',
        tenantId: 'tenant_1',
        type: UsageType.VOICE_MINUTE,
        quantity: 2,
        correlationId: 'corr_123',
        metadata: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          voiceMode: 'SCRIPTED',
          actor: 'AI',
        },
        occurredAt: expect.any(Date),
      });
    });

    it('should record non-voice execution usage', async () => {
      const executionCommand = {
        commandType: 'SEND_EMAIL',
        channel: 'email',
      };

      const decisionResult = {
        actor: 'AI',
      };

      await billingGuard.recordExecutionUsage(
        'tenant_1',
        executionCommand,
        decisionResult,
        'corr_123'
      );

      expect(mockAggregator.recordUsage).toHaveBeenCalledWith({
        eventId: 'exec_corr_123',
        tenantId: 'tenant_1',
        type: UsageType.EXECUTION,
        quantity: 1,
        correlationId: 'corr_123',
        metadata: {
          commandType: 'SEND_EMAIL',
          channel: 'email',
          voiceMode: undefined,
          actor: 'AI',
        },
        occurredAt: expect.any(Date),
      });
    });

    it('should not throw on recording errors', async () => {
      mockAggregator.recordUsage.mockRejectedValue(
        new Error('Recording failed')
      );

      await expect(
        billingGuard.recordExecutionUsage(
          'tenant_1',
          { commandType: 'TEST', channel: 'test' },
          {},
          'corr_123'
        )
      ).resolves.not.toThrow();
    });
  });
});
