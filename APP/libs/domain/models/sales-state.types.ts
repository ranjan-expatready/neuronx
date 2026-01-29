/**
 * Sales State Types - WI-027: Canonical Sales State Machine
 *
 * Types and enums for the canonical sales state machine governing lead lifecycle.
 */

import { z } from 'zod';

// Basic event interface for NeuronX
export interface NeuronxEvent {
  id: string;
  type: string;
  tenantId: string;
  correlationId: string;
  timestamp: Date;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

// Canonical sales states - LOCKED, no additions or removals
export enum LeadState {
  NEW = 'NEW',
  ACK_SENT = 'ACK_SENT',
  CONTACT_ATTEMPTING = 'CONTACT_ATTEMPTING',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED',
  BOOKING_PENDING = 'BOOKING_PENDING',
  BOOKED = 'BOOKED',
  NO_SHOW = 'NO_SHOW',
  CONSULT_DONE = 'CONSULT_DONE',
  PAID = 'PAID',
  LOST = 'LOST',
}

// Actor types for transitions
export enum TransitionActor {
  SYSTEM = 'SYSTEM',
  HUMAN = 'HUMAN',
}

// System-only transitions that cannot be human-triggered
export const SYSTEM_ONLY_TRANSITIONS: Array<{
  from: LeadState;
  to: LeadState;
}> = [
  { from: LeadState.CONTACTED, to: LeadState.QUALIFIED },
  { from: LeadState.CONTACTED, to: LeadState.DISQUALIFIED },
  { from: LeadState.BOOKED, to: LeadState.NO_SHOW },
  { from: LeadState.CONSULT_DONE, to: LeadState.PAID },
  { from: LeadState.CONSULT_DONE, to: LeadState.LOST },
];

// Allowed transitions map
export const ALLOWED_TRANSITIONS: Record<LeadState, LeadState[]> = {
  [LeadState.NEW]: [LeadState.ACK_SENT],
  [LeadState.ACK_SENT]: [LeadState.CONTACT_ATTEMPTING],
  [LeadState.CONTACT_ATTEMPTING]: [LeadState.CONTACTED],
  [LeadState.CONTACTED]: [LeadState.QUALIFIED, LeadState.DISQUALIFIED],
  [LeadState.QUALIFIED]: [LeadState.BOOKING_PENDING],
  [LeadState.BOOKING_PENDING]: [LeadState.BOOKED],
  [LeadState.BOOKED]: [LeadState.CONSULT_DONE, LeadState.NO_SHOW],
  [LeadState.CONSULT_DONE]: [LeadState.PAID, LeadState.LOST],
  [LeadState.DISQUALIFIED]: [], // Terminal state
  [LeadState.NO_SHOW]: [], // Terminal state
  [LeadState.PAID]: [], // Terminal state
  [LeadState.LOST]: [], // Terminal state
};

// Transition requirements
export interface TransitionRequirement {
  from: LeadState;
  to: LeadState;
  actor: TransitionActor;
  requires: string[]; // Required input field names
  explanationRequired: boolean;
  policyReferences?: string[]; // Policy versions/rules used
}

// Complete transition requirements
export const TRANSITION_REQUIREMENTS: TransitionRequirement[] = [
  {
    from: LeadState.NEW,
    to: LeadState.ACK_SENT,
    actor: TransitionActor.HUMAN,
    requires: ['acknowledgment_sent'],
    explanationRequired: false,
  },
  {
    from: LeadState.ACK_SENT,
    to: LeadState.CONTACT_ATTEMPTING,
    actor: TransitionActor.HUMAN,
    requires: ['contact_method', 'scheduled_time'],
    explanationRequired: false,
  },
  {
    from: LeadState.CONTACT_ATTEMPTING,
    to: LeadState.CONTACTED,
    actor: TransitionActor.HUMAN,
    requires: ['contact_outcome', 'contact_timestamp'],
    explanationRequired: true,
  },
  {
    from: LeadState.CONTACTED,
    to: LeadState.QUALIFIED,
    actor: TransitionActor.SYSTEM,
    requires: ['qualification_score', 'qualification_criteria'],
    explanationRequired: true,
    policyReferences: ['decision_policy_v1.0.0', 'qualification_rules'],
  },
  {
    from: LeadState.CONTACTED,
    to: LeadState.DISQUALIFIED,
    actor: TransitionActor.SYSTEM,
    requires: ['disqualification_reason', 'disqualification_criteria'],
    explanationRequired: true,
    policyReferences: ['decision_policy_v1.0.0', 'disqualification_rules'],
  },
  {
    from: LeadState.QUALIFIED,
    to: LeadState.BOOKING_PENDING,
    actor: TransitionActor.HUMAN,
    requires: ['booking_request', 'preferred_times'],
    explanationRequired: false,
  },
  {
    from: LeadState.BOOKING_PENDING,
    to: LeadState.BOOKED,
    actor: TransitionActor.HUMAN,
    requires: ['booking_confirmed', 'meeting_details'],
    explanationRequired: true,
  },
  {
    from: LeadState.BOOKED,
    to: LeadState.CONSULT_DONE,
    actor: TransitionActor.HUMAN,
    requires: ['consultation_completed', 'consultation_outcome'],
    explanationRequired: true,
  },
  {
    from: LeadState.BOOKED,
    to: LeadState.NO_SHOW,
    actor: TransitionActor.SYSTEM,
    requires: ['no_show_detected', 'no_show_policy'],
    explanationRequired: true,
    policyReferences: ['attendance_policy_v1.0.0'],
  },
  {
    from: LeadState.CONSULT_DONE,
    to: LeadState.PAID,
    actor: TransitionActor.SYSTEM,
    requires: ['payment_received', 'payment_amount'],
    explanationRequired: true,
    policyReferences: ['billing_policy_v1.0.0'],
  },
  {
    from: LeadState.CONSULT_DONE,
    to: LeadState.LOST,
    actor: TransitionActor.SYSTEM,
    requires: ['lost_reason', 'follow_up_policy'],
    explanationRequired: true,
    policyReferences: ['retention_policy_v1.0.0'],
  },
];

// Transition attempt request
export interface TransitionAttempt {
  leadId: string;
  fromState: LeadState;
  toState: LeadState;
  actorType: TransitionActor;
  inputs: Record<string, any>; // Structured transition inputs
  correlationId: string;
  requestedBy?: string; // User ID for audit
}

// Transition result
export interface TransitionResult {
  success: boolean;
  leadId: string;
  fromState: LeadState;
  toState: LeadState;
  actorType: TransitionActor;
  reason: string;
  nextAllowedTransitions: LeadState[];
  auditReferenceId: string;
  timestamp: Date;
  correlationId: string;
}

// Transition validation result
export interface TransitionValidation {
  isValid: boolean;
  reason: string;
  requirements?: TransitionRequirement;
}

// Event types for state transitions
export enum TransitionEventType {
  TRANSITION_ATTEMPTED = 'lead_state_transition_attempted',
  TRANSITION_SUCCEEDED = 'lead_state_transition_succeeded',
  TRANSITION_BLOCKED = 'lead_state_transition_blocked',
}

// Transition event payload
export interface TransitionEvent {
  eventType: TransitionEventType;
  tenantId: string;
  leadId: string;
  fromState: LeadState;
  toState: LeadState;
  actorType: TransitionActor;
  reason: string;
  correlationId: string;
  timestamp: Date;
  inputs?: Record<string, any>;
  policyReferences?: string[];
  auditReferenceId: string;
}

// Zod schemas for validation
export const LeadStateSchema = z.nativeEnum(LeadState);
export const TransitionActorSchema = z.nativeEnum(TransitionActor);

export const TransitionAttemptSchema = z.object({
  leadId: z.string().min(1),
  fromState: LeadStateSchema,
  toState: LeadStateSchema,
  actorType: TransitionActorSchema,
  inputs: z.record(z.any()),
  correlationId: z.string().min(1),
  requestedBy: z.string().optional(),
});

export const TransitionResultSchema = z.object({
  success: z.boolean(),
  leadId: z.string(),
  fromState: LeadStateSchema,
  toState: LeadStateSchema,
  actorType: TransitionActorSchema,
  reason: z.string(),
  nextAllowedTransitions: z.array(LeadStateSchema),
  auditReferenceId: z.string(),
  timestamp: z.date(),
  correlationId: z.string(),
});

export const TransitionEventSchema = z.object({
  eventType: z.nativeEnum(TransitionEventType),
  tenantId: z.string(),
  leadId: z.string(),
  fromState: LeadStateSchema,
  toState: LeadStateSchema,
  actorType: TransitionActorSchema,
  reason: z.string(),
  correlationId: z.string(),
  timestamp: z.date(),
  inputs: z.record(z.any()).optional(),
  policyReferences: z.array(z.string()).optional(),
  auditReferenceId: z.string(),
});

// Utility functions
export function isSystemOnlyTransition(
  from: LeadState,
  to: LeadState
): boolean {
  return SYSTEM_ONLY_TRANSITIONS.some(t => t.from === from && t.to === to);
}

export function getAllowedTransitions(from: LeadState): LeadState[] {
  return ALLOWED_TRANSITIONS[from] || [];
}

export function getTransitionRequirement(
  from: LeadState,
  to: LeadState
): TransitionRequirement | null {
  return (
    TRANSITION_REQUIREMENTS.find(req => req.from === from && req.to === to) ||
    null
  );
}

export function isTerminalState(state: LeadState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}
