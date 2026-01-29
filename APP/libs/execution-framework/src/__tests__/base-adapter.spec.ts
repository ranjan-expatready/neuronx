/**
 * Tests for BaseExecutionAdapter - WI-028
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseExecutionAdapter } from '../adapters/base-adapter';
import { ExecutionActionType } from '../types';

// Test implementation of BaseExecutionAdapter
class TestAdapter extends BaseExecutionAdapter {
  constructor() {
    super('TestAdapter', '1.0.0', [ExecutionActionType.SEND_SMS]);
  }

  async execute(command: any): Promise<any> {
    return this.createResult(true, command.commandId, 'test-external-id');
  }
}

describe('BaseExecutionAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.name).toBe('TestAdapter');
      expect(capabilities.version).toBe('1.0.0');
      expect(capabilities.supportedActionTypes).toEqual([
        ExecutionActionType.SEND_SMS,
      ]);
      expect(capabilities.rateLimits).toBeDefined();
    });
  });

  describe('supports', () => {
    it('should support registered action types', () => {
      expect(adapter.supports(ExecutionActionType.SEND_SMS)).toBe(true);
    });

    it('should not support unregistered action types', () => {
      expect(adapter.supports(ExecutionActionType.SEND_EMAIL)).toBe(false);
    });
  });

  describe('boundary violation detection', () => {
    it('should detect state-related keywords', () => {
      const command = {
        commandId: 'test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { state: 'qualified', status: 'active' },
        correlationId: 'corr-1',
      };

      const violations = (adapter as any).detectBoundaryViolations(command);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'state_read')).toBe(true);
    });

    it('should detect decision logic keywords', () => {
      const command = {
        commandId: 'test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { condition: 'if qualified then send' },
        correlationId: 'corr-1',
      };

      const violations = (adapter as any).detectBoundaryViolations(command);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'decision_logic')).toBe(true);
    });

    it('should detect branching logic', () => {
      const command = {
        commandId: 'test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { route: 'branch based on score' },
        correlationId: 'corr-1',
      };

      const violations = (adapter as any).detectBoundaryViolations(command);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'conditional_branching')).toBe(
        true
      );
    });
  });

  describe('createResult', () => {
    it('should create successful result', () => {
      const result = (adapter as any).createResult(
        true,
        'cmd-1',
        'ext-1',
        undefined,
        { test: true }
      );

      expect(result.success).toBe(true);
      expect(result.commandId).toBe('cmd-1');
      expect(result.externalId).toBe('ext-1');
      expect(result.error).toBeUndefined();
      expect(result.metadata).toEqual({ test: true });
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should create failure result', () => {
      const result = (adapter as any).createResult(
        false,
        'cmd-1',
        undefined,
        'Test error'
      );

      expect(result.success).toBe(false);
      expect(result.commandId).toBe('cmd-1');
      expect(result.externalId).toBeUndefined();
      expect(result.error).toBe('Test error');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('idempotency', () => {
    it('should handle first execution', async () => {
      const isExecuted = await (adapter as any).ensureIdempotency('cmd-1');
      expect(isExecuted).toBe(false);
    });

    it('should handle repeated execution', async () => {
      // First execution
      await (adapter as any).ensureIdempotency('cmd-1');

      // Second execution should be idempotent
      const isExecuted = await (adapter as any).ensureIdempotency('cmd-1');
      expect(isExecuted).toBe(true);
    });
  });
});
