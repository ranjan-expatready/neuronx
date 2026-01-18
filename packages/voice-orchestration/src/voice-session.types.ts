import type {
  VoiceOutcome,
  VoiceMode,
  VoiceActor,
  CallDirection,
  ScriptType,
  QualityMetric,
} from './voice-outcome.enums';

// Voice Session - Immutable record of voice interactions
export interface VoiceSession {
  // Primary identifiers
  sessionId: string;
  tenantId: string;

  // Business context
  leadId: string;
  opportunityId?: string;
  stateAtCall: string; // FSM state when call was initiated

  // Voice configuration
  selectedVoiceMode: VoiceMode;
  scriptId?: string;
  scriptType?: ScriptType;

  // Execution details
  actor: VoiceActor;
  direction: CallDirection;

  // Call metadata
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;

  // Voice quality metrics
  qualityMetrics?: Record<QualityMetric, number>;

  // Outcome (MUST be enum - no direct state changes)
  outcome: VoiceOutcome;
  outcomeConfidence?: number;

  // Required logging for all modes
  notes?: string;
  checklistCompleted?: boolean;
  checklistItems?: string[];

  // Policy compliance
  policyVersion: string;
  enforcementMode: 'monitor_only' | 'block';

  // Correlation and audit
  correlationId: string;
  executionTokenId?: string; // From execution authority (WI-034)

  // Billing integration
  billable: boolean;
  billingCategory?: string;

  // Compliance
  recordingUrl?: string;
  complianceFlags?: string[];

  // Metadata
  metadata?: Record<string, any>;
}

// Voice Session Request - What triggers a voice interaction
export interface VoiceSessionRequest {
  tenantId: string;
  leadId: string;
  opportunityId?: string;
  correlationId: string;

  // Context for mode selection
  leadState: string;
  dealValue?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  timeOfDay?: string;
  slaPressure?: boolean;

  // Optional preferences
  preferredMode?: VoiceMode;
  scriptType?: ScriptType;
  maxDurationMinutes?: number;

  // Execution context
  executionTokenId?: string;
}

// Voice Mode Selection Result
export interface VoiceModeSelection {
  selectedMode: VoiceMode;
  reason: string;
  confidence: number;

  // Policy details
  allowedModes: VoiceMode[];
  policyVersion: string;

  // Constraints
  maxDurationMinutes: number;
  requiredScripts: ScriptType[];
  requiresChecklist: boolean;

  // Risk assessment
  riskFactors?: string[];
  overrides?: string[];
}

// Voice Orchestration Context
export interface VoiceOrchestrationContext {
  tenantId: string;
  sessionId: string;
  leadId: string;
  modeSelection: VoiceModeSelection;

  // Execution state
  currentStep?: string;
  scriptProgress?: number;
  checklistProgress?: Record<string, boolean>;

  // Quality monitoring
  qualityThresholds: Record<QualityMetric, number>;
  currentMetrics?: Record<QualityMetric, number>;

  // Policy state
  enforcementMode: 'monitor_only' | 'block';
  policyVersion: string;
}

// Voice Execution Command (for Execution Layer integration)
export interface VoiceExecutionCommand {
  type: 'initiate_voice_call' | 'continue_voice_session' | 'end_voice_session';

  sessionId: string;
  tenantId: string;
  leadId: string;

  // Voice-specific parameters
  phoneNumber: string;
  mode: VoiceMode;
  scriptId?: string;
  maxDurationSeconds?: number;

  // Context
  correlationId: string;
  metadata?: Record<string, any>;
}

// Voice Session Event (for event sourcing)
export interface VoiceSessionEvent {
  eventId: string;
  sessionId: string;
  tenantId: string;
  eventType: string; // session.started | session.ended | quality.updated | etc.

  occurredAt: Date;
  data: Record<string, any>;

  correlationId: string;
  metadata?: Record<string, any>;
}

// Voice Policy Violation (for boundary enforcement integration)
export interface VoicePolicyViolation {
  sessionId: string;
  tenantId: string;
  violationType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';

  description: string;
  evidence: Record<string, any>;

  policyVersion: string;
  correlationId: string;

  createdAt: Date;
}

// Voice Analytics Data (for reporting and optimization)
export interface VoiceAnalyticsData {
  tenantId: string;
  period: string; // YYYY-MM-DD format

  // Volume metrics
  totalSessions: number;
  sessionsByMode: Record<VoiceMode, number>;
  sessionsByOutcome: Record<VoiceOutcome, number>;

  // Quality metrics
  averageDuration: number;
  averageConfidence: number;
  averageScriptAdherence: number;

  // Business impact
  contactRate: number;
  conversionRate: number;
  satisfactionScore?: number;

  // Cost metrics
  totalCost: number;
  costPerMinute: number;
  costByMode: Record<VoiceMode, number>;
}
