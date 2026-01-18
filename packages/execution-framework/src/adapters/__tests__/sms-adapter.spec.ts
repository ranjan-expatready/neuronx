/**
 * Tests for SmsAdapter - WI-028
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmsAdapter } from '../sms-adapter';
import { ExecutionActionType } from '../../types';

describe('SmsAdapter', () => {
  let adapter: SmsAdapter;

  beforeEach(() => {
    adapter = new SmsAdapter();
  });

  describe('capabilities', () => {
    it('should support SEND_SMS action', () => {
      expect(adapter.supports(ExecutionActionType.SEND_SMS)).toBe(true);
    });

    it('should not support other actions', () => {
      expect(adapter.supports(ExecutionActionType.SEND_EMAIL)).toBe(false);
      expect(adapter.supports(ExecutionActionType.MAKE_CALL)).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute valid SMS command successfully', async () => {
      const command = {
        commandId: 'sms-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test SMS message',
          from: '+0987654321',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.commandId).toBe('sms-1');
      expect(result.externalId).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.metadata?.recipient).toBe('+1234567890');
      expect(result.metadata?.messageLength).toBe(16);
    });

    it('should reject command with missing required fields', async () => {
      const command = {
        commandId: 'sms-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          message: 'Test message',
          // Missing 'to' field
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required SMS parameters');
    });

    it('should handle boundary violations', async () => {
      const command = {
        commandId: 'sms-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test message',
          state: 'qualified', // Boundary violation
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Adapter boundary violation');
      expect(result.metadata?.violations).toBeDefined();
    });

    it('should handle idempotent executions', async () => {
      const command = {
        commandId: 'sms-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test message',
        },
        correlationId: 'corr-1',
      };

      // First execution
      const firstResult = await adapter.execute(command);
      expect(firstResult.success).toBe(true);

      // Second execution should be idempotent
      const secondResult = await adapter.execute(command);
      expect(secondResult.success).toBe(true);
      expect(secondResult.metadata?.idempotent).toBe(true);
    });

    it('should handle execution errors', async () => {
      // Mock the adapter to throw an error
      vi.spyOn(adapter as any, 'createResult').mockImplementation(() => {
        throw new Error('Simulated execution error');
      });

      const command = {
        commandId: 'sms-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test message',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated execution error');
    });
  });
});
