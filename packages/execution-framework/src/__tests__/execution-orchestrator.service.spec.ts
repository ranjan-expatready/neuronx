/**
 * Tests for ExecutionOrchestratorService - WI-028
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ExecutionOrchestratorService } from '../orchestrator/execution-orchestrator.service';
import { SalesStateMachine } from '../../../domain';
import {
  ExecutionCommand,
  ExecutionActionType,
  ExecutionResult,
  ExecutionAdapter,
} from '../types';

// Mock adapter for testing
class MockAdapter implements ExecutionAdapter {
  constructor(
    private shouldSucceed = true,
    private supportedActions: ExecutionActionType[] = []
  ) {}

  getCapabilities() {
    return {
      name: 'MockAdapter',
      version: '1.0.0',
      supportedActionTypes: this.supportedActions,
      rateLimits: { requestsPerMinute: 100, burstLimit: 10 },
    };
  }

  supports(actionType: ExecutionActionType): boolean {
    return this.supportedActions.includes(actionType);
  }

  async execute(command: ExecutionCommand): Promise<ExecutionResult> {
    if (this.shouldSucceed) {
      return {
        success: true,
        commandId: command.commandId,
        externalId: `mock-${command.commandId}`,
        timestamp: new Date(),
        metadata: { adapter: 'mock' },
      };
    } else {
      return {
        success: false,
        commandId: command.commandId,
        error: 'Mock adapter failure',
        timestamp: new Date(),
      };
    }
  }
}

describe('ExecutionOrchestratorService', () => {
  let service: ExecutionOrchestratorService;
  let mockEventPublisher: { publish: Mock };
  let mockStateMachine: { getNextStates: Mock };

  beforeEach(() => {
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    mockStateMachine = {
      getNextStates: vi.fn().mockReturnValue([]),
    };
    service = new ExecutionOrchestratorService(
      mockEventPublisher as any,
      mockStateMachine as any
    );
  });

  describe('registerAdapter', () => {
    it('should register adapter for supported action types', () => {
      const adapter = new MockAdapter(true, [ExecutionActionType.SEND_SMS]);

      service.registerAdapter(adapter);

      expect(service.isActionSupported(ExecutionActionType.SEND_SMS)).toBe(
        true
      );
      expect(service.isActionSupported(ExecutionActionType.SEND_EMAIL)).toBe(
        false
      );
    });
  });

  describe('executeCommand', () => {
    beforeEach(() => {
      const adapter = new MockAdapter(true, [ExecutionActionType.SEND_SMS]);
      service.registerAdapter(adapter);
    });

    it('should execute valid command successfully', async () => {
      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { to: '+1234567890', message: 'Test message' },
        correlationId: 'corr-1',
      };

      const result = await service.executeCommand(command);

      expect(result.success).toBe(true);
      expect(result.commandId).toBe('cmd-1');
      expect(result.actionType).toBe(ExecutionActionType.SEND_SMS);
      expect(result.adapterUsed).toBe('MockAdapter');
      expect(result.executionResult?.success).toBe(true);
      expect(result.auditReferenceId).toBeDefined();

      // Verify events were emitted
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid command schema', async () => {
      const invalidCommand = {
        commandId: 'cmd-1',
        // Missing required fields
        actionType: ExecutionActionType.SEND_SMS,
        payload: {},
      };

      const result = await service.executeCommand(invalidCommand as any);

      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('none');

      // Should still emit attempted event
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      const event = mockEventPublisher.publish.mock.calls[0][0];
      expect(event.type).toBe('execution_attempted');
    });

    it('should reject when no adapter is registered', async () => {
      const serviceWithoutAdapter = new ExecutionOrchestratorService(
        mockEventPublisher as any,
        mockStateMachine as any
      );

      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_EMAIL, // No adapter registered
        payload: { to: 'test@example.com', subject: 'Test' },
        correlationId: 'corr-1',
      };

      const result = await serviceWithoutAdapter.executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('none');
    });

    it('should handle adapter execution failure', async () => {
      const failingAdapter = new MockAdapter(false, [
        ExecutionActionType.SEND_EMAIL,
      ]);
      service.registerAdapter(failingAdapter);

      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_EMAIL,
        payload: { to: 'test@example.com', subject: 'Test' },
        correlationId: 'corr-1',
      };

      const result = await service.executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.executionResult?.success).toBe(false);
      expect(result.executionResult?.error).toBe('Mock adapter failure');
    });

    it('should block execution when billing is suspended', async () => {
      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { to: '+1234567890', message: 'Test' },
        correlationId: 'corr-1',
      };

      const context = {
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        billingStatus: 'suspended' as const,
      };

      const result = await service.executeCommand(command, context);

      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('none');
    });

    it('should block execution when capability is denied', async () => {
      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.MAKE_CALL, // Requires VOICE_EXECUTION
        payload: { to: '+1234567890' },
        correlationId: 'corr-1',
      };

      const context = {
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        capabilityGrants: ['SMS_EXECUTION', 'EMAIL_EXECUTION'], // Missing VOICE_EXECUTION
      };

      const result = await service.executeCommand(command, context);

      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('none');
    });

    it('should allow execution with proper capability grants', async () => {
      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { to: '+1234567890', message: 'Test' },
        correlationId: 'corr-1',
      };

      const context = {
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        capabilityGrants: ['SMS_EXECUTION'],
      };

      const result = await service.executeCommand(command, context);

      expect(result.success).toBe(true);
      expect(result.adapterUsed).toBe('MockAdapter');
    });
  });

  describe('getRegisteredAdapters', () => {
    it('should return registered adapters info', () => {
      const smsAdapter = new MockAdapter(true, [ExecutionActionType.SEND_SMS]);
      const emailAdapter = new MockAdapter(true, [
        ExecutionActionType.SEND_EMAIL,
      ]);

      service.registerAdapter(smsAdapter);
      service.registerAdapter(emailAdapter);

      const adapters = service.getRegisteredAdapters();

      expect(adapters).toHaveLength(2);
      expect(adapters).toContainEqual({
        actionType: ExecutionActionType.SEND_SMS,
        adapterName: 'MockAdapter',
      });
      expect(adapters).toContainEqual({
        actionType: ExecutionActionType.SEND_EMAIL,
        adapterName: 'MockAdapter',
      });
    });
  });

  describe('event emission', () => {
    beforeEach(() => {
      const adapter = new MockAdapter(true, [ExecutionActionType.SEND_SMS]);
      service.registerAdapter(adapter);
    });

    it('should emit events with correct structure', async () => {
      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { to: '+1234567890', message: 'Test' },
        correlationId: 'corr-1',
      };

      await service.executeCommand(command);

      // Check attempted event
      const attemptedEvent = mockEventPublisher.publish.mock.calls[0][0];
      expect(attemptedEvent.type).toBe('execution_attempted');
      expect(attemptedEvent.tenantId).toBe('tenant-1');
      expect(attemptedEvent.payload.commandId).toBe('cmd-1');
      expect(attemptedEvent.payload.actionType).toBe(
        ExecutionActionType.SEND_SMS
      );

      // Check succeeded event
      const succeededEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(succeededEvent.type).toBe('execution_succeeded');
      expect(succeededEvent.payload.adapterName).toBe('MockAdapter');
      expect(succeededEvent.payload.success).toBe(true);
    });

    it('should handle event emission failures gracefully', async () => {
      mockEventPublisher.publish.mockRejectedValue(new Error('Event failure'));

      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { to: '+1234567890', message: 'Test' },
        correlationId: 'corr-1',
      };

      // Should still succeed despite event emission failure
      const result = await service.executeCommand(command);
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors in validation', async () => {
      mockStateMachine.getNextStates.mockImplementation(() => {
        throw new Error('State machine error');
      });

      const command: ExecutionCommand = {
        commandId: 'cmd-1',
        tenantId: 'tenant-1',
        leadId: 'lead-1',
        actionType: ExecutionActionType.SEND_SMS,
        payload: { to: '+1234567890', message: 'Test' },
        correlationId: 'corr-1',
      };

      const result = await service.executeCommand(command);

      expect(result.success).toBe(false);
      expect(result.adapterUsed).toBe('none');

      // Should emit failed event
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
      const failedEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(failedEvent.type).toBe('execution_failed');
    });
  });
});
