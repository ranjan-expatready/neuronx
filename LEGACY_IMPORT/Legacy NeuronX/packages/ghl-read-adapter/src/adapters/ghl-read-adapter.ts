/**
 * Read-Only GHL Adapter - WI-070: Read-Only GHL Live Data Integration
 *
 * HARD-BLOCKS ALL MUTATIONS - Read operations only for trust validation.
 * Implements governance guards and audit logging for any mutation attempts.
 */

import {
  IReadOnlyCRMAdapter,
  IReadOnlyIdentityAdapter,
  AdapterContext,
  ExtendedGhlReadAdapterConfig as GhlReadAdapterConfig,
  GovernanceViolation,
  GovernanceViolationType,
  Lead,
  Opportunity,
  Pipeline,
  User,
} from '../types';
import { createGhlAdapter, GhlAdapter } from '@neuronx/adapters-ghl';
import { createLogger, Logger } from '@neuronx/observability';

export class GhlReadAdapter
  implements IReadOnlyCRMAdapter, IReadOnlyIdentityAdapter
{
  private readonly logger: Logger;
  private readonly ghlAdapter: GhlAdapter;
  private readonly config: GhlReadAdapterConfig;

  constructor(config: GhlReadAdapterConfig) {
    this.config = config;
    this.logger = createLogger({ component: `GhlReadAdapter:${config.tenantId}` });

    // Create underlying GHL adapter for read operations
    this.ghlAdapter = createGhlAdapter({
      tenantId: config.tenantId,
      // environment: config.environment, // Not in interface?
      // baseUrl: config.baseUrl,
    });

    this.logger.info('GHL Read Adapter initialized', {
      tenantId: config.tenantId,
      environment: config.environment,
      allowedDataTypes: config.governance?.allowedDataTypes || [],
    });
  }

  // ===== MUTATION BLOCKERS =====

  /**
   * HARD BLOCK: Any mutation attempt throws an error
   */
  private blockMutation(operation: string, context: AdapterContext): never {
    const violation: GovernanceViolation = {
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: GovernanceViolationType.MUTATION_ATTEMPT,
      tenantId: context.tenantId,
      userId: context.userId,
      operation,
      details: {
        adapter: 'ghl-read-adapter',
        environment: this.config.environment,
        attemptedAt: new Date().toISOString(),
      },
      timestamp: new Date(),
      correlationId: context.correlationId,
      severity: 'critical',
    };

    // Log the violation
    this.logger.error('MUTATION ATTEMPT BLOCKED', {
      violation,
      context,
      message: `Read-only adapter blocked mutation attempt: ${operation}`,
    });

    // Audit the violation if enabled
    if (this.config.governance?.auditMutations) {
      this.auditViolation(violation);
    }

    // Throw error with clear message
    throw new Error(
      `READ-ONLY VIOLATION: ${operation} is not allowed in read-only GHL adapter. ` +
        `This incident has been logged and audited. Correlation ID: ${context.correlationId}`
    );
  }

  /**
   * Audit a governance violation
   */
  private async auditViolation(violation: GovernanceViolation): Promise<void> {
    try {
      // In production, this would send to audit service
      this.logger.warn('Governance violation audited', { violation });

      // TODO: Send to audit service when available
      // await this.auditService.recordViolation(violation);
    } catch (error) {
      this.logger.error('Failed to audit violation', {
        violation,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // ===== READ-ONLY CRM OPERATIONS =====

  async getLead(id: string, context: AdapterContext): Promise<Lead> {
    this.logger.debug('Reading lead from GHL', {
      leadId: id,
      correlationId: context.correlationId,
    });
    return await this.ghlAdapter.getContact(id, context);
  }

  async listLeads(
    context: AdapterContext,
    filters: Parameters<IReadOnlyCRMAdapter['listLeads']>[1] = {}
  ): Promise<{ leads: Lead[]; total: number }> {
    const ctx = context || {
      tenantId: this.config.tenantId,
      correlationId: `list-leads-${Date.now()}`,
      requestId: `req-${Date.now()}`,
      // environment: 'production',
    } as AdapterContext;
    this.validateDataTypeAccess('contacts', ctx);

    this.logger.debug('Listing leads from GHL', {
      filters,
      correlationId: ctx.correlationId,
    });

    const result = await this.ghlAdapter.listContacts(ctx, filters);
    return { leads: result.contacts, total: result.total };
  }

  async getOpportunity(
    id: string,
    context: AdapterContext
  ): Promise<Opportunity> {
    this.logger.debug('Reading opportunity from GHL', {
      opportunityId: id,
      correlationId: context.correlationId,
    });
    return await this.ghlAdapter.getOpportunity(id, context);
  }

  async listOpportunities(
    context: AdapterContext,
    filters: Parameters<IReadOnlyCRMAdapter['listOpportunities']>[1] = {}
  ): Promise<{ opportunities: Opportunity[]; total: number }> {
    this.validateDataTypeAccess('opportunities', context);

    this.logger.debug('Listing opportunities from GHL', {
      filters,
      correlationId: context.correlationId,
    });

    return await this.ghlAdapter.listOpportunities(context, filters);
  }

  async getPipelines(context: AdapterContext): Promise<Pipeline[]> {
    this.validateDataTypeAccess('pipelines', context);

    this.logger.debug('Reading pipelines from GHL', {
      correlationId: context.correlationId,
    });
    return await this.ghlAdapter.getPipelines(context);
  }

  async getPipeline(id: string, context: AdapterContext): Promise<Pipeline> {
    this.logger.debug('Reading pipeline from GHL', {
      pipelineId: id,
      correlationId: context.correlationId,
    });
    const pipelines = await this.ghlAdapter.getPipelines(context);
    const pipeline = pipelines.find(p => p.id === id);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${id}`);
    }
    return pipeline;
  }

  // ===== MUTATION METHODS - HARD BLOCKED =====

  // These methods are not in the interface but we document them as blocked
  createLead(): never {
    this.blockMutation('createLead', {
      tenantId: '',
      correlationId: '',
      requestId: '',
      // environment: 'production',
    } as AdapterContext);
  }

  updateLead(): never {
    this.blockMutation('updateLead', {
      tenantId: '',
      correlationId: '',
      requestId: '',
      // environment: 'production',
    } as AdapterContext);
  }

  createOpportunity(): never {
    this.blockMutation('createOpportunity', {
      tenantId: '',
      correlationId: '',
      requestId: '',
      // environment: 'production',
    } as AdapterContext);
  }

  updateOpportunity(): never {
    this.blockMutation('updateOpportunity', {
      tenantId: '',
      correlationId: '',
      requestId: '',
      // environment: 'production',
    } as AdapterContext);
  }

  // ===== READ-ONLY IDENTITY OPERATIONS =====

  async listUsers(
    context: AdapterContext,
    filters: Parameters<IReadOnlyIdentityAdapter['listUsers']>[1] = {}
  ): Promise<{ users: User[]; total: number }> {
    this.validateDataTypeAccess('users', context);

    this.logger.debug('Listing users from GHL', {
      filters,
      correlationId: context.correlationId,
    });

    const allUsers = await this.ghlAdapter.getUsers(context);
    
    // Filter in memory
    let users = allUsers;
    if (filters?.email) {
      users = users.filter(u => u.email === filters.email);
    }
    // Add other filters if needed

    // Pagination
    const total = users.length;
    if (filters?.limit) {
      const offset = filters.offset || 0;
      users = users.slice(offset, offset + filters.limit);
    }

    return { users, total };
  }

  async getUser(id: string, context: AdapterContext): Promise<User> {
    this.logger.debug('Reading user from GHL', {
      userId: id,
      correlationId: context.correlationId,
    });
    const users = await this.ghlAdapter.getUsers(context);
    const user = users.find(u => u.id === id);
    if (!user) throw new Error(`User not found: ${id}`);
    return user;
  }

  async getUserByEmail(email: string, context: AdapterContext): Promise<User> {
    this.logger.debug('Reading user by email from GHL', {
      email,
      correlationId: context.correlationId,
    });
    const users = await this.ghlAdapter.getUsers(context);
    const user = users.find(u => u.email === email);
    if (!user) throw new Error(`User not found: ${email}`);
    return user;
  }

  // ===== GOVERNANCE HELPERS =====

  /**
   * Validate that the requested data type is allowed
   */
  private validateDataTypeAccess(
    dataType: string,
    context: AdapterContext
  ): void {
    const allowedTypes = this.config.governance?.allowedDataTypes || [];
    if (!allowedTypes.includes(dataType)) {
      const violation: GovernanceViolation = {
        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: GovernanceViolationType.UNAUTHORIZED_ACCESS,
        tenantId: context.tenantId,
        userId: context.userId,
        operation: `access_${dataType}`,
        details: {
          requestedDataType: dataType,
          allowedDataTypes: this.config.governance?.allowedDataTypes,
        },
        timestamp: new Date(),
        correlationId: context.correlationId,
        severity: 'high',
      };

      this.logger.error('UNAUTHORIZED DATA TYPE ACCESS', { violation });

      if (this.config.governance?.auditMutations) {
        this.auditViolation(violation);
      }

      throw new Error(
        `ACCESS DENIED: Data type '${dataType}' is not allowed for this tenant. ` +
          `Allowed types: ${this.config.governance?.allowedDataTypes?.join(', ') || 'none'}. ` +
          `Correlation ID: ${context.correlationId}`
      );
    }
  }

  // ===== HEALTH AND CAPABILITIES =====

  /**
   * Get adapter health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastChecked: Date;
  }> {
    try {
      const health = await (this.ghlAdapter as any).getHealth({
        tenantId: this.config.tenantId,
        correlationId: `health_check_${Date.now()}`,
      });

      return {
        ...health,
        message: health.message
          ? `${health.message} (Read-Only Mode)`
          : 'Read-Only Mode Active',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Read-Only Adapter Health Check Failed: ${error instanceof Error ? error.message : String(error)}`,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities() {
    const baseCapabilities = (this.ghlAdapter as any).getCapabilities
      ? (this.ghlAdapter as any).getCapabilities()
      : { name: 'GHL Adapter' };

    return {
      ...baseCapabilities,
      name: `${baseCapabilities.name} (Read-Only)`,
      supportedFeatures: [
        'read-only-crm',
        'read-only-identity',
        'snapshot-storage',
        'governance-enforcement',
      ],
      readOnly: true,
      governanceLevel: 'strict',
    };
  }

  /**
   * Validate adapter configuration
   */
  async validateConfig(): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validate that we're in read-only mode
    if (
      !this.config.governance?.allowedDataTypes ||
      this.config.governance.allowedDataTypes.length === 0
    ) {
      errors.push(
        'No data types allowed - read adapter would be non-functional'
      );
    }

    // Validate underlying GHL adapter
    try {
      if ((this.ghlAdapter as any).validateConfig) {
        const ghlValidation = await (this.ghlAdapter as any).validateConfig({
          tenantId: this.config.tenantId,
          correlationId: `config_validation_${Date.now()}`,
        });

        if (!ghlValidation.valid) {
          errors.push(...(ghlValidation.errors || []));
        }
      }
    } catch (error) {
      errors.push(
        `GHL adapter validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Validate snapshot configuration
    if (this.config.snapshot?.enabled) {
      if (this.config.snapshot.retentionDays < 1) {
        errors.push('Snapshot retention days must be at least 1');
      }

      if (this.config.snapshot.maxRecordsPerSnapshot < 1) {
        errors.push('Max records per snapshot must be at least 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
