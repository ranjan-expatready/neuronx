/**
 * Tests for BaseExecutionAdapter - WI-028
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExecutionActionType,
  ExecutionCommand,
} from '../types/execution.types';
import {
  BaseExecutionAdapter,
  BoundaryViolationError,
} from '../adapters/base-adapter';

// Mock adapter for testing
class MockAdapter extends BaseExecutionAdapter {
  name = 'mock-adapter';
  supportedActionTypes = [ExecutionActionType.SEND_SMS];

  protected async executeCommand(command: ExecutionCommand): Promise<{
    success: boolean;
    externalId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }> {
    return {
      success: true,
      externalId: 'mock-id',
      metadata: { test: true },
    };
  }
}

describe('BaseExecutionAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('supports', () => {
    it('should return true for supported action types', () => {
      expect(adapter.supports(ExecutionActionType.SEND_SMS)).toBe(true);
    });

    it('should return false for unsupported action types', () => {
      expect(adapter.supports(ExecutionActionType.SEND_EMAIL)).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities for supported action types', () => {
      const capabilities = adapter.getCapabilities();
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].actionType).toBe(ExecutionActionType.SEND_SMS);
      expect(capabilities[0].supported).toBe(true);
      expect(capabilities[0].rateLimits).toBeDefined();
    });
  });

  describe('boundary enforcement', () => {
    it('should throw BoundaryViolationError for business logic keys', async () => {
      const command: ExecutionCommand = {
        commandId: 'test-cmd',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Hello',
          state: 'qualified', // FORBIDDEN
          qualification_score: 0.8, // FORBIDDEN
        },
        correlationId: 'corr-1',
      };

      await expect(adapter.execute(command)).rejects.toThrow(
        BoundaryViolationError
      );
      await expect(adapter.execute(command)).rejects.toThrow(
        'Adapter payload contains business logic keys'
      );
    });

    it('should throw BoundaryViolationError for decision-making constructs', async () => {
      const command: ExecutionCommand = {
        commandId: 'test-cmd',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Hello',
          conditions: [{ field: 'score', operator: '>', value: 0.7 }], // FORBIDDEN
          rules: ['rule1', 'rule2'], // FORBIDDEN
        },
        correlationId: 'corr-1',
      };

      await expect(adapter.execute(command)).rejects.toThrow(
        BoundaryViolationError
      );
      await expect(adapter.execute(command)).rejects.toThrow(
        'Adapter payload contains decision-making constructs'
      );
    });

    it('should throw BoundaryViolationError for oversized payloads', async () => {
      const largePayload = 'x'.repeat(10001); // > 10KB
      const command: ExecutionCommand = {
        commandId: 'test-cmd',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: largePayload,
        },
        correlationId: 'corr-1',
      };

      await expect(adapter.execute(command)).rejects.toThrow(
        BoundaryViolationError
      );
      await expect(adapter.execute(command)).rejects.toThrow(
        'Adapter payload too large'
      );
    });

    it('should execute successfully for valid payloads', async () => {
      const command: ExecutionCommand = {
        commandId: 'test-cmd',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Hello World',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('mock-id');
      expect(result.metadata).toEqual({ test: true });
    });
  });

  describe('getHealth', () => {
    it('should return healthy status by default', async () => {
      const health = await adapter.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.lastChecked).toBeInstanceOf(Date);
    });
  });
});
