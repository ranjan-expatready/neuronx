/**
 * Tests for ExecutionOrchestratorService - WI-028
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ExecutionOrchestratorService } from '../orchestrator/execution-orchestrator.service';
import { SalesStateMachine, LeadState } from '../../../domain';
import {
  ExecutionCommand,
  ExecutionActionType,
  ExecutionEventType,
} from '../types/execution.types';
import { SmsAdapter } from '../adapters/sms-adapter';

describe('ExecutionOrchestratorService', () => {
  let orchestrator: ExecutionOrchestratorService;
  let stateMachine: SalesStateMachine;
  let mockEventPublisher: { publish: Mock };
  let smsAdapter: SmsAdapter;

  beforeEach(() => {
    stateMachine = new SalesStateMachine();
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    smsAdapter = new SmsAdapter();
    orchestrator = new ExecutionOrchestratorService(
      stateMachine,
      mockEventPublisher as any
    );
    orchestrator.registerAdapter(ExecutionActionType.SEND_SMS, smsAdapter);
  });

  describe('executeCommand', () => {
    it('should execute valid SMS command successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'sms-cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test message',
        },
        correlationId: 'corr-1',
      };

      const result = await orchestrator.executeCommand(command);

      expect(result.success).toBe(true);
      expect(result.commandId).toBe('sms-cmd-1');
      expect(result.externalId).toBeDefined();

      // Verify events emitted
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);

      // First event: EXECUTION_ATTEMPTED
      const attemptEvent = mockEventPublisher.publish.mock.calls[0][0];
      expect(attemptEvent.type).toBe(ExecutionEventType.EXECUTION_ATTEMPTED);
      expect(attemptEvent.payload.commandId).toBe('sms-cmd-1');

      // Second event: EXECUTION_SUCCEEDED
      const successEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(successEvent.type).toBe(ExecutionEventType.EXECUTION_SUCCEEDED);
      expect(successEvent.payload.commandId).toBe('sms-cmd-1');
    });

    it('should reject commands without registered adapters', async () => {
      const command: ExecutionCommand = {
        commandId: 'email-cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_EMAIL, // No adapter registered
        payload: {
          to: 'test@example.com',
          subject: 'Test',
          body: 'Test body',
        },
        correlationId: 'corr-1',
      };

      const result = await orchestrator.executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('No adapter available');

      // Verify EXECUTION_FAILED event
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
      const failedEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(failedEvent.type).toBe(ExecutionEventType.EXECUTION_FAILED);
    });

    it('should handle adapter execution failures', async () => {
      // Mock the SMS adapter to always fail
      vi.spyOn(smsAdapter, 'execute').mockResolvedValue({
        commandId: 'sms-cmd-1',
        success: false,
        errorMessage: 'SMS delivery failed',
        executedAt: new Date(),
      });

      const command: ExecutionCommand = {
        commandId: 'sms-cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test message',
        },
        correlationId: 'corr-1',
      };

      const result = await orchestrator.executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('SMS delivery failed');

      // Verify EXECUTION_FAILED event
      const failedEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(failedEvent.type).toBe(ExecutionEventType.EXECUTION_FAILED);
      expect(failedEvent.payload.errorMessage).toBe('SMS delivery failed');
    });

    it('should emit boundary violation events', async () => {
      const command: ExecutionCommand = {
        commandId: 'boundary-cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test',
          state: 'qualified', // FORBIDDEN - triggers boundary violation
        },
        correlationId: 'corr-1',
      };

      await expect(orchestrator.executeCommand(command)).rejects.toThrow(
        'Adapter payload contains business logic keys'
      );

      // Verify boundary violation event emitted
      const violationEvent = mockEventPublisher.publish.mock.calls.find(
        call => call[0].type === 'adapter_boundary_violation'
      );
      expect(violationEvent).toBeDefined();
      expect(violationEvent[0].payload.violationType).toBe(
        'BUSINESS_LOGIC_IN_ADAPTER'
      );
    });

    it('should handle event emission failures gracefully', async () => {
      // Mock event publisher to fail
      mockEventPublisher.publish.mockRejectedValue(
        new Error('Event system down')
      );

      const command: ExecutionCommand = {
        commandId: 'sms-cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: {
          to: '+1234567890',
          message: 'Test message',
        },
        correlationId: 'corr-1',
      };

      // Should still execute successfully despite event failure
      const result = await orchestrator.executeCommand(command);
      expect(result.success).toBe(true);
    });
  });

  describe('registerAdapter', () => {
    it('should register adapters correctly', () => {
      const emailAdapter = new (class extends SmsAdapter {
        name = 'email-adapter';
        supportedActionTypes = [ExecutionActionType.SEND_EMAIL];
      })();

      orchestrator.registerAdapter(
        ExecutionActionType.SEND_EMAIL,
        emailAdapter
      );

      const adapters = orchestrator.getRegisteredAdapters();
      expect(adapters.get(ExecutionActionType.SEND_SMS)).toBe(smsAdapter);
      expect(adapters.get(ExecutionActionType.SEND_EMAIL)).toBe(emailAdapter);
    });
  });

  describe('getRegisteredAdapters', () => {
    it('should return a copy of registered adapters', () => {
      const adapters = orchestrator.getRegisteredAdapters();
      expect(adapters.get(ExecutionActionType.SEND_SMS)).toBe(smsAdapter);

      // Modifying the returned map shouldn't affect the original
      adapters.clear();
      expect(
        orchestrator.getRegisteredAdapters().get(ExecutionActionType.SEND_SMS)
      ).toBe(smsAdapter);
    });
  });
});
