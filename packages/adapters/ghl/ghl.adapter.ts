// GHL Adapter - Implements canonical interfaces
// NO business logic, NO GHL types exported, pure protocol translation

import {
  ICRMAdapter,
  IConversationAdapter,
  IWorkflowAdapter,
  IIdentityAdapter,
  ICalendarAdapter,
  IBaseAdapter,
  AdapterContext,
  Lead,
  Opportunity,
  Pipeline,
  Message,
  Conversation,
  Workflow,
  WorkflowExecution,
  User,
  CreateLeadRequest,
  UpdateLeadRequest,
  CreateOpportunityRequest,
  UpdateOpportunityRequest,
  SendMessageRequest,
  TriggerWorkflowRequest,
} from '../contracts';

import { GhlClient } from './ghl.client';
import { GhlMapper } from './ghl.mapper';
import { TokenVault } from '../security/token-vault';
import { GhlCapabilityPolicyResolver, GhlCapability } from '../contracts';
import { BillingSyncService } from '@neuronx/billing-entitlements';

export class GhlAdapter
  implements
    ICRMAdapter,
    IConversationAdapter,
    IWorkflowAdapter,
    IIdentityAdapter,
    ICalendarAdapter,
    IBaseAdapter
{
  private client: GhlClient;
  private tokenVault: TokenVault;
  private capabilityResolver?: GhlCapabilityPolicyResolver;
  private billingService?: BillingSyncService;

  constructor(
    private config: {
      tenantId: string;
      environment: 'dev' | 'stage' | 'prod';
      baseUrl?: string;
    }
  ) {
    this.tokenVault = new TokenVault();
  }

  /**
   * Set capability resolver and billing service for capability enforcement
   */
  setCapabilityEnforcement(
    capabilityResolver: GhlCapabilityPolicyResolver,
    billingService: BillingSyncService
  ): void {
    this.capabilityResolver = capabilityResolver;
    this.billingService = billingService;
  }

  private async ensureClient(context: AdapterContext): Promise<GhlClient> {
    if (this.client) {
      return this.client;
    }

    // Get token for this tenant/environment
    const token = await this.tokenVault.getToken({
      tenantId: context.tenantId,
      provider: 'ghl',
      environment: this.config.environment,
    });

    this.client = new GhlClient({
      baseUrl: this.config.baseUrl || 'https://services.leadconnectorhq.com',
      token: token.accessToken,
    });

    return this.client;
  }

  // ===== ICRMAdapter Implementation =====

  async createLead(
    request: CreateLeadRequest,
    context: AdapterContext
  ): Promise<Lead> {
    await this.checkCapability(
      'crm_create_lead' as GhlCapability,
      context,
      'createLead'
    );

    const client = await this.ensureClient(context);

    const ghlData = GhlMapper.unmapLead({
      ...request,
      tenantId: context.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Lead);

    const response = await client.createContact(
      ghlData,
      await this.getLocationId(context)
    );
    const ghlContact = response.contact || response;

    return GhlMapper.mapContact(ghlContact, context.tenantId);
  }

  async updateLead(
    request: UpdateLeadRequest,
    context: AdapterContext
  ): Promise<Lead> {
    const client = await this.ensureClient(context);

    const updates = GhlMapper.unmapLeadUpdate(request);
    const response = await client.updateContact(request.id, updates);

    return GhlMapper.mapContact(response.contact || response, context.tenantId);
  }

  async getLead(id: string, context: AdapterContext): Promise<Lead> {
    const client = await this.ensureClient(context);
    const response = await client.getContact(id);

    return GhlMapper.mapContact(response.contact || response, context.tenantId);
  }

  async listLeads(
    filters: any = {},
    context: AdapterContext
  ): Promise<{ leads: Lead[]; total: number }> {
    const client = await this.ensureClient(context);

    const params = {
      locationId: await this.getLocationId(context),
      limit: filters.limit || 100,
      offset: filters.offset || 0,
      ...filters,
    };

    const response = await client.getContacts(params);
    const leads = GhlMapper.mapContacts(
      response.contacts || response.data || [],
      context.tenantId
    );

    return {
      leads,
      total: response.total || response.meta?.total || leads.length,
    };
  }

  async createOpportunity(
    request: CreateOpportunityRequest,
    context: AdapterContext
  ): Promise<Opportunity> {
    const client = await this.ensureClient(context);

    const ghlData = GhlMapper.unmapOpportunity({
      ...request,
      tenantId: context.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Opportunity);

    const response = await client.createOpportunity(
      ghlData,
      await this.getLocationId(context)
    );
    const ghlOpportunity = response.opportunity || response;

    return GhlMapper.mapOpportunity(ghlOpportunity, context.tenantId);
  }

  async updateOpportunity(
    request: UpdateOpportunityRequest,
    context: AdapterContext
  ): Promise<Opportunity> {
    const client = await this.ensureClient(context);

    const updates = GhlMapper.unmapOpportunityUpdate(request);
    const response = await client.updateOpportunity(request.id, updates);

    return GhlMapper.mapOpportunity(
      response.opportunity || response,
      context.tenantId
    );
  }

  async getOpportunity(
    id: string,
    context: AdapterContext
  ): Promise<Opportunity> {
    const client = await this.ensureClient(context);
    const response = await client.getOpportunity(id);

    return GhlMapper.mapOpportunity(
      response.opportunity || response,
      context.tenantId
    );
  }

  async listOpportunities(
    filters: any = {},
    context: AdapterContext
  ): Promise<{ opportunities: Opportunity[]; total: number }> {
    const client = await this.ensureClient(context);

    const params = {
      locationId: await this.getLocationId(context),
      limit: filters.limit || 100,
      offset: filters.offset || 0,
      ...filters,
    };

    const response = await client.getOpportunities(params);
    const opportunities = GhlMapper.mapOpportunities(
      response.opportunities || response.data || [],
      context.tenantId
    );

    return {
      opportunities,
      total: response.total || response.meta?.total || opportunities.length,
    };
  }

  async getPipelines(context: AdapterContext): Promise<Pipeline[]> {
    const client = await this.ensureClient(context);
    const response = await client.getPipelines(
      await this.getLocationId(context)
    );

    return GhlMapper.mapPipelines(
      response.pipelines || response.data || [],
      context.tenantId
    );
  }

  async getPipeline(id: string, context: AdapterContext): Promise<Pipeline> {
    const client = await this.ensureClient(context);
    const response = await client.getPipeline(id);

    return GhlMapper.mapPipeline(
      response.pipeline || response,
      context.tenantId
    );
  }

  // ===== IConversationAdapter Implementation =====

  async sendMessage(
    request: SendMessageRequest,
    context: AdapterContext
  ): Promise<Message> {
    await this.checkCapability(
      'conversation_send_message' as GhlCapability,
      context,
      'sendMessage'
    );

    const client = await this.ensureClient(context);

    const ghlData = GhlMapper.unmapMessage({
      ...request,
      tenantId: context.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Message);

    const response = await client.sendMessage(request.conversationId, ghlData);

    return GhlMapper.mapMessage(response.message || response, context.tenantId);
  }

  async listMessages(
    conversationId: string,
    filters: any = {},
    context: AdapterContext
  ): Promise<{ messages: Message[]; total: number }> {
    const client = await this.ensureClient(context);

    const params = {
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      ...filters,
    };

    const response = await client.getConversationMessages(
      conversationId,
      params
    );
    const messages = GhlMapper.mapMessages(
      response.messages || response.data || [],
      context.tenantId
    );

    return {
      messages,
      total: response.total || response.meta?.total || messages.length,
    };
  }

  async getConversation(
    id: string,
    context: AdapterContext
  ): Promise<Conversation> {
    const client = await this.ensureClient(context);
    const response = await client.getConversation(id);

    return GhlMapper.mapConversation(
      response.conversation || response,
      context.tenantId
    );
  }

  async listConversations(
    filters: any = {},
    context: AdapterContext
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const client = await this.ensureClient(context);

    const params = {
      locationId: await this.getLocationId(context),
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      ...filters,
    };

    const response = await client.getConversations(params);
    const conversations = GhlMapper.mapConversations(
      response.conversations || response.data || [],
      context.tenantId
    );

    return {
      conversations,
      total: response.total || response.meta?.total || conversations.length,
    };
  }

  async tagConversation(
    conversationId: string,
    tags: string[],
    context: AdapterContext
  ): Promise<Conversation> {
    const client = await this.ensureClient(context);

    const response = await client.updateConversation(conversationId, { tags });
    const ghlConversation = response.conversation || response;

    return GhlMapper.mapConversation(ghlConversation, context.tenantId);
  }

  async updateConversationStatus(
    conversationId: string,
    status: 'active' | 'closed' | 'pending',
    context: AdapterContext
  ): Promise<Conversation> {
    const client = await this.ensureClient(context);

    const ghlStatus =
      status === 'active'
        ? 'active'
        : status === 'closed'
          ? 'closed'
          : 'pending';
    const response = await client.updateConversation(conversationId, {
      status: ghlStatus,
    });

    return GhlMapper.mapConversation(
      response.conversation || response,
      context.tenantId
    );
  }

  // ===== IWorkflowAdapter Implementation =====

  async triggerWorkflow(
    request: TriggerWorkflowRequest,
    context: AdapterContext
  ): Promise<WorkflowExecution> {
    await this.checkCapability(
      'workflow_trigger' as GhlCapability,
      context,
      'triggerWorkflow'
    );

    const client = await this.ensureClient(context);

    const ghlData = {
      contactId: request.contactId,
      opportunityId: request.opportunityId,
      ...request.triggerData,
    };

    const response = await client.triggerWorkflow(request.workflowId, ghlData);

    return GhlMapper.mapWorkflowExecution(
      response.execution || response,
      context.tenantId
    );
  }

  async pauseWorkflow(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution> {
    const client = await this.ensureClient(context);
    const response = await client.pauseWorkflow(executionId);

    return GhlMapper.mapWorkflowExecution(
      response.execution || response,
      context.tenantId
    );
  }

  async resumeWorkflow(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution> {
    const client = await this.ensureClient(context);
    const response = await client.resumeWorkflow(executionId);

    return GhlMapper.mapWorkflowExecution(
      response.execution || response,
      context.tenantId
    );
  }

  async cancelWorkflow(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution> {
    const client = await this.ensureClient(context);
    const response = await client.cancelWorkflow(executionId);

    return GhlMapper.mapWorkflowExecution(
      response.execution || response,
      context.tenantId
    );
  }

  async getWorkflowExecution(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution> {
    const client = await this.ensureClient(context);
    const response = await client.getWorkflowExecution(executionId);

    return GhlMapper.mapWorkflowExecution(
      response.execution || response,
      context.tenantId
    );
  }

  async listWorkflowExecutions(
    filters: any = {},
    context: AdapterContext
  ): Promise<{ executions: WorkflowExecution[]; total: number }> {
    // Note: GHL doesn't have a bulk executions endpoint
    // This is a simplified implementation
    const executions: WorkflowExecution[] = [];

    return {
      executions,
      total: 0,
    };
  }

  async getWorkflows(context: AdapterContext): Promise<Workflow[]> {
    const client = await this.ensureClient(context);

    const params = {
      locationId: await this.getLocationId(context),
    };

    const response = await client.getWorkflows(params);

    return GhlMapper.mapWorkflows(
      response.workflows || response.data || [],
      context.tenantId
    );
  }

  async getWorkflow(id: string, context: AdapterContext): Promise<Workflow> {
    const client = await this.ensureClient(context);
    const response = await client.getWorkflow(id);

    return GhlMapper.mapWorkflow(
      response.workflow || response,
      context.tenantId
    );
  }

  // ===== IIdentityAdapter Implementation =====

  async listUsers(
    filters: any = {},
    context: AdapterContext
  ): Promise<{ users: User[]; total: number }> {
    const client = await this.ensureClient(context);

    const params = {
      limit: filters.limit || 100,
      offset: filters.offset || 0,
      ...filters,
    };

    const response = await client.getUsers(params);
    const users = GhlMapper.mapUsers(
      response.users || response.data || [],
      context.tenantId
    );

    return {
      users,
      total: response.total || response.meta?.total || users.length,
    };
  }

  async getUser(id: string, context: AdapterContext): Promise<User> {
    const client = await this.ensureClient(context);
    const response = await client.getUser(id);

    return GhlMapper.mapUser(response.user || response, context.tenantId);
  }

  async getUserByEmail(email: string, context: AdapterContext): Promise<User> {
    // GHL doesn't have direct email lookup, so we search
    const { users } = await this.listUsers({ email }, context);
    return users.find(user => user.email === email)!;
  }

  async mapExternalUser(
    externalId: string,
    context: AdapterContext
  ): Promise<User | null> {
    try {
      return await this.getUser(externalId, context);
    } catch {
      return null;
    }
  }

  async syncUserPermissions(
    userId: string,
    context: AdapterContext
  ): Promise<User> {
    // Get fresh user data from GHL
    return await this.getUser(userId, context);
  }

  // ===== ICalendarAdapter Implementation =====

  async createEvent(
    event: any,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent> {
    await this.checkCapability(
      'calendar_create_event' as GhlCapability,
      context,
      'createEvent'
    );

    const client = await this.ensureClient(context);

    const ghlData = GhlMapper.unmapCalendarEvent({
      ...event,
      tenantId: context.tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as import('../domain/models').CalendarEvent);

    const response = await client.createCalendarEvent(
      ghlData,
      await this.getLocationId(context)
    );

    return GhlMapper.mapCalendarEvent(
      response.event || response,
      context.tenantId
    );
  }

  async updateEvent(
    id: string,
    updates: any,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent> {
    const client = await this.ensureClient(context);
    const response = await client.updateCalendarEvent(id, updates);

    return GhlMapper.mapCalendarEvent(
      response.event || response,
      context.tenantId
    );
  }

  async getEvent(
    id: string,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent> {
    const client = await this.ensureClient(context);
    const response = await client.getCalendarEvent(id);

    return GhlMapper.mapCalendarEvent(
      response.event || response,
      context.tenantId
    );
  }

  async listEvents(
    filters: any = {},
    context: AdapterContext
  ): Promise<{
    events: import('../domain/models').CalendarEvent[];
    total: number;
  }> {
    const client = await this.ensureClient(context);

    const params = {
      locationId: await this.getLocationId(context),
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      ...filters,
    };

    const response = await client.getCalendarEvents(params);
    const events = GhlMapper.mapCalendarEvents(
      response.events || response.data || [],
      context.tenantId
    );

    return {
      events,
      total: response.total || response.meta?.total || events.length,
    };
  }

  async cancelEvent(
    id: string,
    reason?: string,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent> {
    const client = await this.ensureClient(context);

    // Update status to cancelled
    const updates = { status: 'cancelled' };
    const response = await client.updateCalendarEvent(id, updates);

    return GhlMapper.mapCalendarEvent(
      response.event || response,
      context.tenantId
    );
  }

  // ===== IBaseAdapter Implementation =====

  async getHealth(context: AdapterContext): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastChecked: Date;
  }> {
    try {
      const client = await this.ensureClient(context);
      // Simple health check - try to get user info
      await client.getUsers({ limit: 1 });

      return {
        status: 'healthy',
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        lastChecked: new Date(),
      };
    }
  }

  getCapabilities() {
    return {
      name: 'GHL Adapter',
      version: '1.0.0',
      supportedFeatures: [
        'crm',
        'conversations',
        'workflows',
        'identity',
        'calendar',
        'webhooks',
      ],
      rateLimits: {
        requestsPerMinute: 100,
        burstLimit: 20,
      },
    };
  }

  async validateConfig(
    context: AdapterContext
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    try {
      // Try to get a token
      await this.tokenVault.getToken({
        tenantId: context.tenantId,
        provider: 'ghl',
        environment: this.config.environment,
      });
    } catch {
      errors.push('No valid GHL token available');
    }

    // Check if location ID can be resolved
    try {
      await this.getLocationId(context);
    } catch {
      errors.push('Cannot resolve location ID for tenant');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ===== Capability Enforcement =====

  /**
   * Check if a GHL capability is allowed for the current tenant
   */
  private async checkCapability(
    capability: GhlCapability,
    context: AdapterContext,
    operation: string
  ): Promise<void> {
    if (!this.capabilityResolver || !this.billingService) {
      // If capability enforcement is not configured, allow by default
      return;
    }

    try {
      // Get tenant's plan tier
      const planTier = await this.getTenantPlanTier(context.tenantId);

      // Check capability
      const result = this.capabilityResolver.checkCapability({
        tenantId: context.tenantId,
        planTier,
        capability,
        environment: this.config.environment,
        userId: context.userId,
      });

      if (!result.allowed) {
        // Log capability denial
        if (this.capabilityResolver.isAuditEnabled('auditCapabilityDenials')) {
          this.logCapabilityEvent('denied', capability, context, result);
        }
        throw new Error(
          `Capability ${capability} not allowed: ${result.reason}`
        );
      }

      // Log capability usage if auditing is enabled
      if (this.capabilityResolver.isAuditEnabled('auditCapabilityUsage')) {
        this.logCapabilityEvent('allowed', capability, context, result);
      }
    } catch (error) {
      // Re-throw capability errors
      if (error.message.includes('Capability')) {
        throw error;
      }
      // For other errors (like plan lookup failures), log and allow
      console.warn(
        `Capability check failed for ${capability}, allowing by default:`,
        error.message
      );
    }
  }

  /**
   * Get tenant's current plan tier
   */
  private async getTenantPlanTier(tenantId: string): Promise<any> {
    if (!this.billingService) {
      throw new Error('Billing service not configured for capability checks');
    }

    try {
      // Get current billing state for tenant
      const billingState = await this.billingService.getBillingStatus(tenantId);
      return billingState.planTier || 'FREE'; // Default to FREE if unknown
    } catch (error) {
      console.warn(
        `Failed to get plan tier for tenant ${tenantId}, defaulting to FREE:`,
        error.message
      );
      return 'FREE';
    }
  }

  /**
   * Log capability usage/denial events
   */
  private logCapabilityEvent(
    eventType: 'allowed' | 'denied',
    capability: GhlCapability,
    context: AdapterContext,
    result: any
  ): void {
    const logData = {
      eventType: `ghl_capability_${eventType}`,
      tenantId: context.tenantId,
      capability,
      planTier: result.planTier,
      reason: result.reason,
      enforcementMode: result.enforcementMode,
      timestamp: new Date().toISOString(),
      userId: context.userId,
      operation: 'adapter_execution',
    };

    console.log(`GHL Capability ${eventType}:`, logData);
  }

  // ===== Helper Methods =====

  private async getLocationId(context: AdapterContext): Promise<string> {
    // This should be stored in tenant/workspace configuration
    // For now, return a placeholder - in real implementation this would
    // be retrieved from tenant configuration
    const token = await this.tokenVault.getToken({
      tenantId: context.tenantId,
      provider: 'ghl',
      environment: this.config.environment,
    });

    // Extract location ID from token metadata or configuration
    // This is a simplified implementation
    return token.locationId || 'default_location';
  }
}
