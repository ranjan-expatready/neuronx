import { NeuronxEvent, ExecutionCommand } from '@neuronx/contracts';

export interface AdapterCapabilities {
  inboundEvents: string[]; // Events this adapter can receive
  outboundCommands: string[]; // Commands this adapter can execute
  supportedFeatures: string[];
}

export interface AdapterHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  details?: Record<string, any>;
}

export interface InboundAdapter {
  // Convert external events to NeuronX events
  onEvent(externalEvent: any): Promise<NeuronxEvent[]>;

  // Health and capabilities
  getHealth(): Promise<AdapterHealth>;
  getCapabilities(): AdapterCapabilities;
}

export interface OutboundAdapter {
  // Execute NeuronX commands
  execute(command: ExecutionCommand): Promise<ExecutionResult>;

  // Health and capabilities
  getHealth(): Promise<AdapterHealth>;
  getCapabilities(): AdapterCapabilities;
}

export interface BidirectionalAdapter extends InboundAdapter, OutboundAdapter {}

export interface ExecutionResult {
  success: boolean;
  externalId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AdapterConfig {
  tenantId: string;
  adapterType: string;
  credentials?: Record<string, string>;
  endpoints?: Record<string, string>;
  mappings?: Record<string, string>;
  limits?: {
    rateLimit?: number;
    concurrency?: number;
    timeout?: number;
  };
}
