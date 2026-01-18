// Decision Engine Package Exports - WI-029: Decision Engine & Actor Orchestration

export {
  // Types
  DecisionEnforcementMode,
  type DecisionContext,
  type DecisionResult,
  type ActorCapability,
  type RiskAssessment,
  type DecisionEngineConfig,
  type DecisionAuditEvent,
  DEFAULT_DECISION_CONFIG,
} from './types';

// Interfaces
export {
  type DecisionContextBuilder,
  type DecisionEngine,
  type RiskGate,
  type ActorSelector,
  type VoiceModeSelector,
} from './types';

// Policy Configuration - WI-042
export {
  type DecisionPolicy,
  type RiskLevel,
  type DecisionEnforcementMode,
  type DealValueThresholds,
  type RiskThresholds,
  type SlaUrgencyMapping,
  type VoiceModeRules,
  type VoiceConstraints,
  type ActorSelectionRules,
  type ExecutionModeRules,
  type EscalationRules,
  type RetryLimits,
  DecisionPolicySchema,
} from './policy/decision-policy.types';

export { DecisionPolicyLoader } from './policy/decision-policy.loader';

export { DecisionPolicyResolver } from './policy/decision-policy.resolver';

// Implementations
export { DecisionContextBuilderImpl } from './decision-context';

export { DecisionEngineImpl } from './decision-engine';

export { RiskGateImpl } from './risk-gate';

export { ActorSelectorImpl } from './actor-selector';

export { VoiceModeSelectorImpl } from './voice-mode-selector';
