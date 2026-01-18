// Pipeline package exports - WI-027: Authoritative Stage Gate

export {
  CanonicalOpportunityStage,
  type StageValidationResult,
  type PipelineStageMapping,
  type PipelineConfiguration,
  type StageEnforcementMode,
  type StageTransitionEvent,
} from './types';

export {
  type PipelineStageRegistry,
  DEFAULT_PIPELINE_CONFIGURATION,
} from './pipeline-stage-registry';

export {
  type StageTransitionValidator,
  StageTransitionValidatorImpl,
} from './stage-transition-validator';

export { InMemoryPipelineStageRegistry } from './in-memory-pipeline-registry';
