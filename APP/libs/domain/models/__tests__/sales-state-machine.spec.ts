/**
 * Tests for SalesStateMachine - WI-027
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SalesStateMachine,
  LeadState,
  TransitionActor,
} from '../sales-state.types';

describe('SalesStateMachine', () => {
  let stateMachine: SalesStateMachine;

  beforeEach(() => {
    stateMachine = new SalesStateMachine();
  });

  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: { acknowledgment_sent: true },
        correlationId: 'corr-1',
      };

      const result = stateMachine.validateTransition(attempt);
      expect(result.isValid).toBe(true);
      expect(result.reason).toContain('valid');
    });

    it('should reject invalid transitions', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.QUALIFIED, // Invalid direct transition
        actorType: TransitionActor.HUMAN,
        inputs: {},
        correlationId: 'corr-1',
      };

      const result = stateMachine.validateTransition(attempt);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('should reject system-only transitions by human actors', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.CONTACTED,
        toState: LeadState.QUALIFIED, // System-only transition
        actorType: TransitionActor.HUMAN, // Wrong actor
        inputs: { qualification_score: 0.8 },
        correlationId: 'corr-1',
      };

      const result = stateMachine.validateTransition(attempt);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('SYSTEM actor');
    });

    it('should allow system-only transitions by system actors', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.CONTACTED,
        toState: LeadState.QUALIFIED,
        actorType: TransitionActor.SYSTEM,
        inputs: { qualification_score: 0.8, qualification_criteria: {} },
        correlationId: 'corr-1',
      };

      const result = stateMachine.validateTransition(attempt);
      expect(result.isValid).toBe(true);
    });

    it('should reject transitions with missing required inputs', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.NEW,
        toState: LeadState.ACK_SENT,
        actorType: TransitionActor.HUMAN,
        inputs: {}, // Missing acknowledgment_sent
        correlationId: 'corr-1',
      };

      const result = stateMachine.validateTransition(attempt);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Missing required inputs');
    });

    it('should reject transitions with wrong actor type', () => {
      const attempt = {
        leadId: 'lead-1',
        fromState: LeadState.CONTACTED,
        toState: LeadState.QUALIFIED,
        actorType: TransitionActor.HUMAN, // Should be SYSTEM
        inputs: { qualification_score: 0.8, qualification_criteria: {} },
        correlationId: 'corr-1',
      };

      const result = stateMachine.validateTransition(attempt);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('SYSTEM actor');
    });
  });

  describe('getNextStates', () => {
    it('should return allowed next states', () => {
      const nextStates = stateMachine.getNextStates(LeadState.NEW);
      expect(nextStates).toEqual([LeadState.ACK_SENT]);
    });

    it('should return empty array for terminal states', () => {
      const nextStates = stateMachine.getNextStates(LeadState.PAID);
      expect(nextStates).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states', () => {
      expect(stateMachine.isTerminalState(LeadState.PAID)).toBe(true);
      expect(stateMachine.isTerminalState(LeadState.LOST)).toBe(true);
      expect(stateMachine.isTerminalState(LeadState.DISQUALIFIED)).toBe(true);
    });

    it('should identify non-terminal states', () => {
      expect(stateMachine.isTerminalState(LeadState.NEW)).toBe(false);
      expect(stateMachine.isTerminalState(LeadState.CONTACTED)).toBe(false);
    });
  });

  describe('canActorPerformTransition', () => {
    it('should allow valid actor transitions', () => {
      const canPerform = stateMachine.canActorPerformTransition(
        LeadState.NEW,
        LeadState.ACK_SENT,
        TransitionActor.HUMAN
      );
      expect(canPerform).toBe(true);
    });

    it('should block system-only transitions for human actors', () => {
      const canPerform = stateMachine.canActorPerformTransition(
        LeadState.CONTACTED,
        LeadState.QUALIFIED,
        TransitionActor.HUMAN
      );
      expect(canPerform).toBe(false);
    });

    it('should allow system-only transitions for system actors', () => {
      const canPerform = stateMachine.canActorPerformTransition(
        LeadState.CONTACTED,
        LeadState.QUALIFIED,
        TransitionActor.SYSTEM
      );
      expect(canPerform).toBe(true);
    });

    it('should block invalid transitions regardless of actor', () => {
      const canPerform = stateMachine.canActorPerformTransition(
        LeadState.NEW,
        LeadState.PAID,
        TransitionActor.SYSTEM
      );
      expect(canPerform).toBe(false);
    });
  });

  describe('getSystemOnlyTransitions', () => {
    it('should return all system-only transitions', () => {
      const systemOnly = stateMachine.getSystemOnlyTransitions();
      expect(systemOnly).toEqual([
        { from: LeadState.CONTACTED, to: LeadState.QUALIFIED },
        { from: LeadState.CONTACTED, to: LeadState.DISQUALIFIED },
        { from: LeadState.BOOKED, to: LeadState.NO_SHOW },
        { from: LeadState.CONSULT_DONE, to: LeadState.PAID },
        { from: LeadState.CONSULT_DONE, to: LeadState.LOST },
      ]);
    });
  });

  describe('validateInputs', () => {
    it('should pass valid inputs', () => {
      const requirement = {
        from: LeadState.NEW,
        to: LeadState.ACK_SENT,
        actor: TransitionActor.HUMAN,
        requires: ['acknowledgment_sent'],
        explanationRequired: false,
      };

      const result = stateMachine.validateInputs(
        { acknowledgment_sent: true },
        requirement
      );

      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    it('should detect missing inputs', () => {
      const requirement = {
        from: LeadState.NEW,
        to: LeadState.ACK_SENT,
        actor: TransitionActor.HUMAN,
        requires: ['acknowledgment_sent', 'timestamp'],
        explanationRequired: false,
      };

      const result = stateMachine.validateInputs(
        { acknowledgment_sent: true },
        requirement
      );

      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['timestamp']);
    });

    it('should detect invalid inputs', () => {
      const requirement = {
        from: LeadState.NEW,
        to: LeadState.ACK_SENT,
        actor: TransitionActor.HUMAN,
        requires: ['acknowledgment_sent'],
        explanationRequired: false,
      };

      const result = stateMachine.validateInputs(
        { acknowledgment_sent: null },
        requirement
      );

      expect(result.isValid).toBe(false);
      expect(result.invalid).toEqual(['acknowledgment_sent']);
    });
  });
});
