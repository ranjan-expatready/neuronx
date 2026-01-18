// NeuronX Shared Contracts
// This package contains shared TypeScript types, Zod schemas, and interfaces

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

// Common interfaces and types
export interface ExecutionCommand {
  action: string;
  parameters: Record<string, any>;
  correlationId: string;
  tenantId: string;
  timestamp: Date;
}

export interface ExecutionResult {
  success: boolean;
  correlationId: string;
  tenantId: string;
  timestamp: Date;
  data?: any;
  error?: string;
}

// Common Zod schemas can be added here as needed
