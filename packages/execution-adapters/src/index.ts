// Execution Adapters - WI-028: Adapter-First Execution Layer
// Adapter-first execution framework ensuring NeuronX decides, adapters execute

// Core types
export * from './types/execution.types';

// Adapters
export {
  BaseExecutionAdapter,
  BoundaryViolationError,
} from './adapters/base-adapter';
export { SmsAdapter } from './adapters/sms-adapter';
export { EmailAdapter } from './adapters/email-adapter';
export { VoiceAdapter } from './adapters/voice-adapter';
export { CalendarAdapter } from './adapters/calendar-adapter';
export { CrmAdapter } from './adapters/crm-adapter';

// Orchestrator
export { ExecutionOrchestratorService } from './orchestrator/execution-orchestrator.service';
