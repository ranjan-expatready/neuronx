/**
 * Tests for SalesStateTransitionService - WI-027
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SalesStateTransitionService } from '../sales-state-transition.service';
import {
  SalesStateMachine,
  LeadState,
  TransitionActor,
  TransitionEventType,
} from '../../models';

describe('SalesStateTransitionService', () => {
  let service: SalesStateTransitionService;
  let stateMachine: SalesStateMachine;
  let mockEventPublisher: { publish: Mock };

  beforeEach(() => {
    stateMachine = new SalesStateMachine();
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    service = new SalesStateTransitionService(
      stateMachine,
      mockEventPublisher as any
    );
  });

  describe('attemptTransition', () => {
    it('should succeed for valid transitions', async () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: { acknowledgment_sent: true },
        correlationId: 'corr-1',
      };

      const result = await service.attemptTransition(attempt);

      expect(result.success).toBe(true);
      expect(result.leadId).toBe('lead-1');
      expect(result.fromState).toBe(LeadState.NEW);
      expect(result.toState).toBe(LeadState.ACK_SENT);
      expect(result.reason).toContain('successfully');
      expect(result.auditReferenceId).toBeDefined();

      // Verify events were emitted
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);

      // First call should be TRANSITION_ATTEMPTED
      const attemptedEvent = mockEventPublisher.publish.mock.calls[0][0];
      expect(attemptedEvent.type).toBe(
        TransitionEventType.TRANSITION_ATTEMPTED
      );
      expect(attemptedEvent.payload.leadId).toBe('lead-1');

      // Second call should be TRANSITION_SUCCEEDED
      const succeededEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(succeededEvent.type).toBe(
        TransitionEventType.TRANSITION_SUCCEEDED
      );
      expect(succeededEvent.payload.leadId).toBe('lead-1');
    });

    it('should fail for invalid transitions', async () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.QUALIFIED, // Invalid transition
        actorType: TransitionActor.HUMAN,
        inputs: {},
        correlationId: 'corr-1',
      };

      const result = await service.attemptTransition(attempt);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('not allowed');
      expect(result.nextAllowedTransitions).toEqual([LeadState.ACK_SENT]);

      // Verify events were emitted
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);

      // First call should be TRANSITION_ATTEMPTED
      const attemptedEvent = mockEventPublisher.publish.mock.calls[0][0];
      expect(attemptedEvent.type).toBe(
        TransitionEventType.TRANSITION_ATTEMPTED
      );

      // Second call should be TRANSITION_BLOCKED
      const blockedEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(blockedEvent.type).toBe(TransitionEventType.TRANSITION_BLOCKED);
    });

    it('should block system-only transitions by human actors', async () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.CONTACTED,
        toState: LeadState.QUALIFIED,
        actorType: TransitionActor.HUMAN, // Wrong actor
        inputs: { qualification_score: 0.8, qualification_criteria: {} },
        correlationId: 'corr-1',
      };

      const result = await service.attemptTransition(attempt);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('SYSTEM actor');

      // Verify TRANSITION_BLOCKED event
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
      const blockedEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(blockedEvent.type).toBe(TransitionEventType.TRANSITION_BLOCKED);
    });

    it('should handle event emission failures gracefully', async () => {
      // Mock event publisher to fail
      mockEventPublisher.publish.mockRejectedValue(
        new Error('Event emission failed')
      );

      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: { acknowledgment_sent: true },
        correlationId: 'corr-1',
      };

      // Should still succeed despite event emission failure
      const result = await service.attemptTransition(attempt);
      expect(result.success).toBe(true);
    });

    it('should handle unexpected errors', async () => {
      // Mock state machine to throw an error
      vi.spyOn(stateMachine, 'validateTransition').mockImplementation(() => {
        throw new Error('Unexpected validation error');
      });

      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: { acknowledgment_sent: true },
        correlationId: 'corr-1',
      };

      const result = await service.attemptTransition(attempt);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Unexpected validation error');

      // Should still emit TRANSITION_BLOCKED event
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
      const blockedEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(blockedEvent.type).toBe(TransitionEventType.TRANSITION_BLOCKED);
    });
  });

  describe('getNextStates', () => {
    it('should delegate to state machine', () => {
      const spy = vi.spyOn(stateMachine, 'getNextStates');
      service.getNextStates(LeadState.NEW);
      expect(spy).toHaveBeenCalledWith(LeadState.NEW);
    });
  });

  describe('canActorPerformTransition', () => {
    it('should delegate to state machine', () => {
      const spy = vi.spyOn(stateMachine, 'canActorPerformTransition');
      service.canActorPerformTransition(
        LeadState.NEW,
        LeadState.ACK_SENT,
        TransitionActor.HUMAN
      );
      expect(spy).toHaveBeenCalledWith(
        LeadState.NEW,
        LeadState.ACK_SENT,
        TransitionActor.HUMAN
      );
    });
  });

  describe('validateTransition', () => {
    it('should delegate to state machine', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: { acknowledgment_sent: true },
        correlationId: 'corr-1',
      };

      const spy = vi.spyOn(stateMachine, 'validateTransition');
      service.validateTransition(attempt);
      expect(spy).toHaveBeenCalledWith(attempt);
    });
  });

  describe('event emission', () => {
    it('should emit properly formatted events', async () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: { acknowledgment_sent: true },
        correlationId: 'corr-1',
        requestedBy: 'user-123',
      };

      await service.attemptTransition(attempt);

      // Check the succeeded event format
      const succeededEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(succeededEvent).toMatchObject({
        id: expect.stringContaining('transition_lead-1_'),
        type: TransitionEventType.TRANSITION_SUCCEEDED,
        tenantId: 'system', // TODO: Extract from context
        correlationId: 'corr-1',
        payload: {
          leadId: 'lead-1',
          fromState: LeadState.NEW,
          toState: LeadState.ACK_SENT,
          actorType: TransitionActor.HUMAN,
          reason: 'Transition completed successfully',
          inputs: { acknowledgment_sent: true },
          policyReferences: undefined,
        },
        metadata: {
          source: 'sales-state-transition-service',
          version: '1.0.0',
        },
      });
    });

    it('should include policy references for system transitions', async () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.CONTACTED,
        toState: LeadState.QUALIFIED,
        actorType: TransitionActor.SYSTEM,
        inputs: { qualification_score: 0.8, qualification_criteria: {} },
        correlationId: 'corr-1',
      };

      await service.attemptTransition(attempt);

      const succeededEvent = mockEventPublisher.publish.mock.calls[1][0];
      expect(succeededEvent.payload.policyReferences).toEqual([
        'decision_policy_v1.0.0',
        'qualification_rules',
      ]);
    });
  });
});
