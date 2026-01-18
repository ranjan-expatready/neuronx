/**
 * Sales State Machine - WI-027: Canonical Sales State Machine
 *
 * Finite state machine governing lead lifecycle transitions.
 * This is the single source of truth for lead state management.
 */

import {
  LeadState,
  TransitionActor,
  SYSTEM_ONLY_TRANSITIONS,
  TransitionAttempt,
  TransitionValidation,
  TransitionRequirement,
  isSystemOnlyTransition,
  getAllowedTransitions,
  getTransitionRequirement,
  TransitionAttemptSchema,
} from './sales-state.types';

/**
 * Canonical Sales State Machine
 *
 * Enforces the finite state machine for lead lifecycle management.
 * This is the authoritative component for all lead state transitions.
 */
export class SalesStateMachine {
  /**
   * Validate if a transition is allowed
   */
  validateTransition(attempt: TransitionAttempt): TransitionValidation {
    const { fromState, toState, actorType, inputs } = attempt;

    // Validate input schema
    const validationResult = TransitionAttemptSchema.safeParse(attempt);
    if (!validationResult.success) {
      return {
        isValid: false,
        reason: `Invalid transition attempt: ${validationResult.error.message}`,
      };
    }

    // Check if transition is in allowed transitions
    const allowedTransitions = getAllowedTransitions(fromState);
    if (!allowedTransitions.includes(toState)) {
      return {
        isValid: false,
        reason: `Transition from ${fromState} to ${toState} is not allowed. Allowed transitions: ${allowedTransitions.join(', ')}`,
      };
    }

    // Check system-only transitions
    if (
      isSystemOnlyTransition(fromState, toState) &&
      actorType !== TransitionActor.SYSTEM
    ) {
      return {
        isValid: false,
        reason: `Transition from ${fromState} to ${toState} can only be performed by SYSTEM actor, not ${actorType}`,
      };
    }

    // Get transition requirements
    const requirement = getTransitionRequirement(fromState, toState);
    if (!requirement) {
      return {
        isValid: false,
        reason: `No transition requirements defined for ${fromState} → ${toState}`,
      };
    }

    // Validate required inputs are present
    const missingInputs = requirement.requires.filter(req => !(req in inputs));
    if (missingInputs.length > 0) {
      return {
        isValid: false,
        reason: `Missing required inputs for transition: ${missingInputs.join(', ')}`,
      };
    }

    // Validate actor type matches requirement
    if (requirement.actor !== actorType) {
      return {
        isValid: false,
        reason: `Transition requires ${requirement.actor} actor, but ${actorType} was provided`,
      };
    }

    return {
      isValid: true,
      reason: 'Transition is valid',
      requirements: requirement,
    };
  }

  /**
   * Get all possible next states from current state
   */
  getNextStates(fromState: LeadState): LeadState[] {
    return getAllowedTransitions(fromState);
  }

  /**
   * Check if a state is terminal (no further transitions allowed)
   */
  isTerminalState(state: LeadState): boolean {
    return getAllowedTransitions(state).length === 0;
  }

  /**
   * Get transition requirements for a specific transition
   */
  getTransitionRequirements(
    from: LeadState,
    to: LeadState
  ): TransitionRequirement | null {
    return getTransitionRequirement(from, to);
  }

  /**
   * Get all valid transitions from current state
   */
  getValidTransitions(
    fromState: LeadState
  ): Array<{ to: LeadState; requirement: TransitionRequirement }> {
    const allowed = getAllowedTransitions(fromState);
    return allowed
      .map(to => {
        const requirement = getTransitionRequirement(fromState, to);
        return requirement ? { to, requirement } : null;
      })
      .filter(
        (item): item is { to: LeadState; requirement: TransitionRequirement } =>
          item !== null
      );
  }

  /**
   * Determine if a transition can be initiated by the given actor
   */
  canActorPerformTransition(
    from: LeadState,
    to: LeadState,
    actor: TransitionActor
  ): boolean {
    // Check if transition is allowed at all
    if (!getAllowedTransitions(from).includes(to)) {
      return false;
    }

    // Check system-only restrictions
    if (isSystemOnlyTransition(from, to) && actor !== TransitionActor.SYSTEM) {
      return false;
    }

    // Check actor requirements
    const requirement = getTransitionRequirement(from, to);
    return requirement ? requirement.actor === actor : false;
  }

  /**
   * Get all system-only transitions (for auditing/debugging)
   */
  getSystemOnlyTransitions(): Array<{ from: LeadState; to: LeadState }> {
    return [...SYSTEM_ONLY_TRANSITIONS];
  }

  /**
   * Validate transition inputs against requirements
   */
  validateInputs(
    inputs: Record<string, any>,
    requirements: TransitionRequirement
  ): { isValid: boolean; missing: string[]; invalid: string[] } {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const required of requirements.requires) {
      if (!(required in inputs)) {
        missing.push(required);
      } else if (inputs[required] === null || inputs[required] === undefined) {
        invalid.push(required);
      }
    }

    return {
      isValid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
    };
  }
}
