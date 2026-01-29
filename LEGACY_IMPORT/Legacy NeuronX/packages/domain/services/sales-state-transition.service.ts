/**
 * Sales State Transition Service - WI-027: Canonical Sales State Machine
 *
 * Orchestrates lead state transitions with validation, event emission, and audit logging.
 * This service is the only way to change lead states in NeuronX.
 */

import { Injectable } from '@nestjs/common';
import {
  SalesStateMachine,
  LeadState,
  TransitionAttempt,
  TransitionResult,
  TransitionEvent,
  TransitionEventType,
  TransitionActor,
} from '../models';
// import type { NeuronxEvent } from '@neuronx/contracts';

// Temporary until contracts package builds correctly
interface NeuronxEvent {
  id: string;
  type: string;
  tenantId: string;
  correlationId: string;
  timestamp: Date;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

// Temporary EventPublisher interface until eventing package builds
interface EventPublisher {
  publish(event: any): Promise<void>;
  publishBatch(events: any[]): Promise<void>;
}

/**
 * Service for managing lead state transitions
 *
 * This is the authoritative service for all lead state changes.
 * It validates transitions, emits audit events, and ensures state consistency.
 */
@Injectable()
export class SalesStateTransitionService {
  constructor(
    private readonly stateMachine: SalesStateMachine,
    private readonly eventPublisher: EventPublisher
  ) {}

  /**
   * Attempt to transition a lead to a new state
   *
   * This is the ONLY way to change lead states in NeuronX.
   * All transitions go through this service for validation and audit.
   */
  async attemptTransition(
    attempt: TransitionAttempt
  ): Promise<TransitionResult> {
    const { leadId, fromState, toState, actorType, correlationId } = attempt;
    const timestamp = new Date();

    // Generate audit reference ID
    const auditReferenceId = `transition_${leadId}_${Date.now()}_${correlationId}`;

    try {
      // Emit transition attempted event
      await this.emitEvent({
        eventType: TransitionEventType.TRANSITION_ATTEMPTED,
        tenantId: 'system', // TODO: Extract from context
        leadId,
        fromState,
        toState,
        actorType,
        reason: 'Transition initiated',
        correlationId,
        timestamp,
        inputs: attempt.inputs,
        auditReferenceId,
      });

      // Validate the transition
      const validation = this.stateMachine.validateTransition(attempt);

      if (!validation.isValid) {
        // Transition blocked - emit event and return failure
        await this.emitEvent({
          eventType: TransitionEventType.TRANSITION_BLOCKED,
          tenantId: 'system', // TODO: Extract from context
          leadId,
          fromState,
          toState,
          actorType,
          reason: validation.reason,
          correlationId,
          timestamp,
          auditReferenceId,
        });

        return {
          success: false,
          leadId,
          fromState,
          toState,
          actorType,
          reason: validation.reason,
          nextAllowedTransitions: this.stateMachine.getNextStates(fromState),
          auditReferenceId,
          timestamp,
          correlationId,
        };
      }

      // Transition is valid - perform the transition
      // In a real implementation, this would update the lead record in the database
      // For now, we just validate and emit success

      const nextAllowedTransitions = this.stateMachine.getNextStates(toState);

      // Emit transition succeeded event
      await this.emitEvent({
        eventType: TransitionEventType.TRANSITION_SUCCEEDED,
        tenantId: 'system', // TODO: Extract from context
        leadId,
        fromState,
        toState,
        actorType,
        reason: 'Transition completed successfully',
        correlationId,
        timestamp,
        auditReferenceId,
        policyReferences: validation.requirements?.policyReferences,
      });

      return {
        success: true,
        leadId,
        fromState,
        toState,
        actorType,
        reason: 'Transition completed successfully',
        nextAllowedTransitions,
        auditReferenceId,
        timestamp,
        correlationId,
      };
    } catch (error) {
      // Handle unexpected errors
      const errorReason =
        error instanceof Error
          ? error.message
          : 'Unknown error during transition';

      await this.emitEvent({
        eventType: TransitionEventType.TRANSITION_BLOCKED,
        tenantId: 'system', // TODO: Extract from context
        leadId,
        fromState,
        toState,
        actorType,
        reason: `Unexpected error: ${errorReason}`,
        correlationId,
        timestamp,
        auditReferenceId,
      });

      return {
        success: false,
        leadId,
        fromState,
        toState,
        actorType,
        reason: errorReason,
        nextAllowedTransitions: this.stateMachine.getNextStates(fromState),
        auditReferenceId,
        timestamp,
        correlationId,
      };
    }
  }

  /**
   * Get possible next states for a lead
   */
  getNextStates(fromState: LeadState): LeadState[] {
    return this.stateMachine.getNextStates(fromState);
  }

  /**
   * Check if a transition can be performed by the given actor
   */
  canActorPerformTransition(
    from: LeadState,
    to: LeadState,
    actor: TransitionActor
  ): boolean {
    return this.stateMachine.canActorPerformTransition(from, to, actor);
  }

  /**
   * Validate a transition attempt without executing it
   */
  validateTransition(attempt: TransitionAttempt): {
    isValid: boolean;
    reason: string;
    requirements?: any;
  } {
    const validation = this.stateMachine.validateTransition(attempt);
    return {
      isValid: validation.isValid,
      reason: validation.reason,
      requirements: validation.requirements,
    };
  }

  /**
   * Emit a transition event
   */
  private async emitEvent(event: TransitionEvent): Promise<void> {
    try {
      // Convert to NeuronxEvent format
      const neuronxEvent: NeuronxEvent = {
        id: event.auditReferenceId,
        type: event.eventType,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        timestamp: event.timestamp,
        payload: {
          leadId: event.leadId,
          fromState: event.fromState,
          toState: event.toState,
          actorType: event.actorType,
          reason: event.reason,
          inputs: event.inputs,
          policyReferences: event.policyReferences,
        },
        metadata: {
          source: 'sales-state-transition-service',
          version: '1.0.0',
        },
      };

      await this.eventPublisher.publish(neuronxEvent);
    } catch (error) {
      // Log event emission failure but don't fail the transition
      console.error('Failed to emit transition event:', error);
      // In production, this would be logged to a monitoring system
    }
  }
}
