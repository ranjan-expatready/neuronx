/**
 * Tests for Execution Adapters - WI-028
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExecutionActionType,
  ExecutionCommand,
} from '../types/execution.types';
import { SmsAdapter } from '../adapters/sms-adapter';
import { EmailAdapter } from '../adapters/email-adapter';
import { VoiceAdapter } from '../adapters/voice-adapter';
import { CalendarAdapter } from '../adapters/calendar-adapter';
import { CrmAdapter } from '../adapters/crm-adapter';

describe('Execution Adapters', () => {
  describe('SmsAdapter', () => {
    let adapter: SmsAdapter;

    beforeEach(() => {
      adapter = new SmsAdapter();
    });

    it('should support SEND_SMS action type', () => {
      expect(adapter.supports(ExecutionActionType.SEND_SMS)).toBe(true);
      expect(adapter.supports(ExecutionActionType.SEND_EMAIL)).toBe(false);
    });

    it('should execute SMS commands successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'sms-test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test SMS message',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.commandId).toBe('sms-test-1');
      expect(result.success).toBe(true);
      expect(result.externalId).toBeDefined();
      expect(result.executedAt).toBeInstanceOf(Date);
    });

    it('should reject commands with missing required fields', async () => {
      const command: ExecutionCommand = {
        commandId: 'sms-test-2',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          // Missing 'to' and 'message'
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Missing required fields');
    });

    it('should reject commands with wrong action type', async () => {
      const command: ExecutionCommand = {
        commandId: 'sms-test-3',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_EMAIL, // Wrong type
        payload: {
          to: '+1234567890',
          message: 'Test',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain(
        'SMS adapter cannot handle action type'
      );
    });
  });

  describe('EmailAdapter', () => {
    let adapter: EmailAdapter;

    beforeEach(() => {
      adapter = new EmailAdapter();
    });

    it('should support SEND_EMAIL action type', () => {
      expect(adapter.supports(ExecutionActionType.SEND_EMAIL)).toBe(true);
      expect(adapter.supports(ExecutionActionType.SEND_SMS)).toBe(false);
    });

    it('should execute email commands successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'email-test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_EMAIL,
        payload: {
          to: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test email body',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.externalId).toBeDefined();
    });

    it('should reject commands with missing required fields', async () => {
      const command: ExecutionCommand = {
        commandId: 'email-test-2',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_EMAIL,
        payload: {
          // Missing fields
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('Missing required fields');
    });
  });

  describe('VoiceAdapter', () => {
    let adapter: VoiceAdapter;

    beforeEach(() => {
      adapter = new VoiceAdapter();
    });

    it('should support MAKE_CALL action type', () => {
      expect(adapter.supports(ExecutionActionType.MAKE_CALL)).toBe(true);
    });

    it('should execute voice commands successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'voice-test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.MAKE_CALL,
        payload: {
          to: '+1234567890',
          script: 'qualification_script_v1',
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.externalId).toBeDefined();
    });
  });

  describe('CalendarAdapter', () => {
    let adapter: CalendarAdapter;

    beforeEach(() => {
      adapter = new CalendarAdapter();
    });

    it('should support BOOK_CALENDAR action type', () => {
      expect(adapter.supports(ExecutionActionType.BOOK_CALENDAR)).toBe(true);
    });

    it('should execute calendar commands successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'calendar-test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.BOOK_CALENDAR,
        payload: {
          title: 'Sales Call',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
          attendees: ['lead@example.com'],
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.externalId).toBeDefined();
    });
  });

  describe('CrmAdapter', () => {
    let adapter: CrmAdapter;

    beforeEach(() => {
      adapter = new CrmAdapter();
    });

    it('should support UPDATE_CRM action type', () => {
      expect(adapter.supports(ExecutionActionType.UPDATE_CRM)).toBe(true);
    });

    it('should execute CRM commands successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'crm-test-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.UPDATE_CRM,
        payload: {
          operation: 'update_lead_status',
          data: { status: 'qualified' },
        },
        correlationId: 'corr-1',
      };

      const result = await adapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.externalId).toBeDefined();
    });
  });
});
