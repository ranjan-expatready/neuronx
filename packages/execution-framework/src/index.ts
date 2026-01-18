// Execution Framework - WI-028: Adapter-First Execution Layer
// Ensures NeuronX authority over stateless, auditable execution

export * from './types';
export * from './adapters/base-adapter';
export * from './adapters/sms-adapter';
export * from './adapters/email-adapter';
export * from './adapters/voice-adapter';
export * from './adapters/calendar-adapter';
export * from './adapters/crm-adapter';
export * from './orchestrator/execution-orchestrator.service';
