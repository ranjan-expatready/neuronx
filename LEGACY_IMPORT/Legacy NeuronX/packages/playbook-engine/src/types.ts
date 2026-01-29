/**
 * Playbook Engine Types - WI-028: Authoritative Playbook Engine
 *
 * Defines the canonical schema for sales playbooks as enforceable business logic.
 */

import { CanonicalOpportunityStage } from '@neuronx/pipeline';

/**
 * Playbook enforcement modes
 */
export type PlaybookEnforcementMode =
  | 'monitor_only'
  | 'block'
  | 'block_and_revert';

/**
 * Communication channels available for actions
 */
export type CommunicationChannel =
  | 'voice'
  | 'sms'
  | 'email'
  | 'chat'
  | 'calendar';

/**
 * Types of evidence that can be collected
 */
export type EvidenceType =
  | 'call_attempt_logged'
  | 'call_connected'
  | 'call_completed'
  | 'message_sent'
  | 'message_delivered'
  | 'email_opened'
  | 'meeting_scheduled'
  | 'meeting_completed'
  | 'qualification_complete'
  | 'disqualification_complete'
  | 'followup_scheduled';

/**
 * Action retry policy
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMinutes: number;
  backoffMultiplier: number;
  maxDelayMinutes?: number;
}

/**
 * Required action within a stage
 */
export interface StageAction {
  actionId: string;
  actionType:
    | 'contact_attempt'
    | 'qualification_call'
    | 'followup'
    | 'send_message'
    | 'schedule_meeting';
  channel: CommunicationChannel;
  slaMinutes: number;
  scriptId?: string; // Reference to script content
  templateId?: string; // Reference to message template
  evidenceRequired: EvidenceType;
  retryPolicy?: RetryPolicy;
  humanAllowed: boolean; // Whether human intervention is allowed
  aiAllowed: boolean; // Whether AI automation is allowed
}

/**
 * Success/failure conditions for stage transitions
 */
export interface TransitionCondition {
  conditionType:
    | 'evidence_present'
    | 'evidence_absent'
    | 'time_elapsed'
    | 'manual_decision';
  evidenceType?: EvidenceType;
  threshold?: number; // For evidence counts, time thresholds, etc.
  operator?: 'gte' | 'lte' | 'eq'; // Comparison operator
}

/**
 * Escalation rules for failed stages
 */
export interface EscalationRule {
  triggerCondition: TransitionCondition;
  escalationType: 'notify_manager' | 'reassign' | 'mark_lost' | 'custom_action';
  delayMinutes?: number;
  targetRole?: string;
  notificationTemplate?: string;
}

/**
 * Stage definition within a playbook
 */
export interface PlaybookStage {
  stageId: string;
  canonicalStage: CanonicalOpportunityStage;
  displayName: string;
  description: string;

  // What must be done to complete this stage
  mustDo: StageAction[];

  // Transition conditions
  onSuccess: {
    condition: TransitionCondition;
    nextStage: string; // Reference to another stage ID
  };

  onFailure: {
    condition: TransitionCondition;
    nextStage: string; // Reference to another stage ID
  };

  // Optional escalation rules
  escalations?: EscalationRule[];

  // Stage-specific settings
  maxDurationMinutes?: number;
  autoAdvanceDelayMinutes?: number;
}

/**
 * Complete playbook definition
 */
export interface Playbook {
  playbookId: string;
  version: string;
  name: string;
  description: string;
  tenantId?: string; // If tenant-specific, otherwise null for global

  entryStage: string; // Stage ID to start with
  stages: Record<string, PlaybookStage>; // Stage ID -> Stage definition

  // Global settings
  defaultRetryPolicy?: RetryPolicy;
  maxOverallDurationDays?: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
}

/**
 * Canonical execution commands that NeuronX sends to adapters
 */
export interface ExecutionCommand {
  commandId: string;
  tenantId: string;
  opportunityId: string;
  playbookId: string;
  stageId: string;
  actionId: string;

  commandType:
    | 'EXECUTE_CONTACT'
    | 'SEND_MESSAGE'
    | 'SCHEDULE_MEETING'
    | 'FOLLOW_UP';

  channel: CommunicationChannel;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  voiceMode?: 'SCRIPTED' | 'CONVERSATIONAL';

  // Command-specific data
  contactData?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };

  messageData?: {
    templateId?: string;
    subject?: string;
    body: string;
    variables?: Record<string, any>;
  };

  meetingData?: {
    title: string;
    durationMinutes: number;
    calendarId?: string;
  };

  scriptId?: string; // Reference to call script

  // Execution constraints
  humanAllowed: boolean;
  aiAllowed: boolean;
  maxDurationMinutes?: number;

  // Retry policy
  retryPolicy?: RetryPolicy;

  // Metadata
  correlationId: string;
  requestedAt: Date;
  evidenceRequired: EvidenceType;
}

/**
 * Evidence of action completion
 */
export interface ActionEvidence {
  evidenceId: string;
  tenantId: string;
  opportunityId: string;
  playbookId: string;
  stageId: string;
  actionId: string;

  evidenceType: EvidenceType;
  collectedAt: Date;
  collectedBy: string; // 'system', 'human', 'ai', or user ID

  // Evidence data
  data: Record<string, any>;

  // Quality metrics
  confidence?: number; // 0.0 to 1.0
  source: 'webhook' | 'api' | 'manual' | 'system';

  correlationId: string;
}

/**
 * Stage evaluation result
 */
export interface StageEvaluationResult {
  canAdvance: boolean;
  nextStage?: string;
  reason: string;
  requiredEvidence: EvidenceType[];
  missingEvidence: EvidenceType[];
  blockingActions: string[]; // Action IDs that must be completed
}

/**
 * Playbook enforcement result
 */
export interface PlaybookEnforcementResult {
  allowed: boolean;
  reason: string;
  executionCommands?: ExecutionCommand[];
  stageEvaluation?: StageEvaluationResult;
  enforced: boolean;
  logged: boolean;
}

/**
 * Playbook transition event for audit
 */
export interface PlaybookTransitionEvent {
  eventId: string;
  tenantId: string;
  opportunityId: string;
  playbookId: string;
  fromStage?: string;
  toStage: string;
  trigger: 'evidence' | 'timeout' | 'manual' | 'escalation';
  evidence?: ActionEvidence[];
  enforced: boolean;
  enforcementMode: PlaybookEnforcementMode;
  correlationId: string;
  timestamp: Date;
}
