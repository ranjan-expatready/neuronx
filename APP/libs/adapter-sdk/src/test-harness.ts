import { NeuronxEvent, ExecutionCommand } from '@neuronx/contracts';
import {
  InboundAdapter,
  OutboundAdapter,
  AdapterConfig,
  ExecutionResult,
} from './interfaces';

export class AdapterTestHarness {
  constructor(private config: AdapterConfig) {}

  // Test inbound adapter event transformation
  async testInboundTransformation(
    adapter: InboundAdapter,
    externalEventSamples: any[]
  ): Promise<InboundTestResult> {
    const results: InboundTestResult = {
      totalEvents: externalEventSamples.length,
      successfulTransformations: 0,
      failedTransformations: 0,
      neuronxEvents: [],
      errors: [],
    };

    for (const externalEvent of externalEventSamples) {
      try {
        const neuronxEvents = await adapter.onEvent(externalEvent);
        results.successfulTransformations++;
        results.neuronxEvents.push(...neuronxEvents);
      } catch (error) {
        results.failedTransformations++;
        results.errors.push({
          externalEvent,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Test outbound adapter command execution
  async testOutboundExecution(
    adapter: OutboundAdapter,
    commandSamples: ExecutionCommand[]
  ): Promise<OutboundTestResult> {
    const results: OutboundTestResult = {
      totalCommands: commandSamples.length,
      successfulExecutions: 0,
      failedExecutions: 0,
      results: [],
      errors: [],
    };

    for (const command of commandSamples) {
      try {
        const result = await adapter.execute(command);
        results.successfulExecutions++;
        results.results.push(result);
      } catch (error) {
        results.failedExecutions++;
        results.errors.push({
          command,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Test adapter health checks
  async testHealthChecks(
    adapter: InboundAdapter | OutboundAdapter
  ): Promise<HealthTestResult> {
    try {
      const health = await adapter.getHealth();
      const capabilities = adapter.getCapabilities();

      return {
        healthy: health.status === 'healthy',
        responseTime: Date.now() - health.lastCheck.getTime(),
        capabilities: capabilities,
        details: health.details,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  // Generate test data for common adapter types
  static generateGHLWebhookSamples(): any[] {
    return [
      {
        id: 'ghl-123',
        type: 'contact.created',
        data: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
        },
      },
      {
        id: 'ghl-124',
        type: 'workflow.completed',
        data: {
          workflowId: 'nurture-001',
          contactId: 'ghl-123',
          steps: ['email_sent', 'link_clicked', 'meeting_booked'],
        },
      },
    ];
  }

  static generateExecutionCommands(): ExecutionCommand[] {
    return [
      {
        id: 'cmd-001',
        tenantId: 'tenant-123',
        type: 'ghl.contact.sync',
        data: {
          externalId: 'ghl-123',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        metadata: {
          correlationId: 'event-123',
          priority: 'normal',
        },
      },
      {
        id: 'cmd-002',
        tenantId: 'tenant-123',
        type: 'ghl.workflow.trigger',
        data: {
          workflowId: 'nurture-sequence',
          contactId: 'ghl-123',
        },
        metadata: {
          correlationId: 'event-124',
          priority: 'high',
        },
      },
    ];
  }
}

export interface InboundTestResult {
  totalEvents: number;
  successfulTransformations: number;
  failedTransformations: number;
  neuronxEvents: NeuronxEvent[];
  errors: Array<{
    externalEvent: any;
    error: string;
  }>;
}

export interface OutboundTestResult {
  totalCommands: number;
  successfulExecutions: number;
  failedExecutions: number;
  results: ExecutionResult[];
  errors: Array<{
    command: ExecutionCommand;
    error: string;
  }>;
}

export interface HealthTestResult {
  healthy: boolean;
  responseTime?: number;
  capabilities?: any;
  details?: Record<string, any>;
  error?: string;
}
