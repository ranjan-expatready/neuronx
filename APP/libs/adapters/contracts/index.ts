// Canonical adapter contracts for NeuronX
// These define the interface between core business logic and external systems
// NO vendor-specific types allowed - only canonical domain models

import {
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
  AdapterContext,
} from '../domain/models';

// GHL Capability Policy - WI-048
export * from './ghl-capability-policy.types';
export { GhlCapabilityPolicyLoader } from './ghl-capability-policy.loader';
export { GhlCapabilityPolicyResolver } from './ghl-capability-policy.resolver';

/**
 * CRM Adapter - Manages leads, opportunities, and sales processes
 */
export interface ICRMAdapter {
  /**
   * Create a new lead
   */
  createLead(
    request: CreateLeadRequest,
    context: AdapterContext
  ): Promise<Lead>;

  /**
   * Update an existing lead
   */
  updateLead(
    request: UpdateLeadRequest,
    context: AdapterContext
  ): Promise<Lead>;

  /**
   * Get a lead by ID
   */
  getLead(id: string, context: AdapterContext): Promise<Lead>;

  /**
   * List leads with optional filtering
   */
  listLeads(
    filters?: {
      email?: string;
      phone?: string;
      tags?: string[];
      status?: string;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{ leads: Lead[]; total: number }>;

  /**
   * Create a new opportunity
   */
  createOpportunity(
    request: CreateOpportunityRequest,
    context: AdapterContext
  ): Promise<Opportunity>;

  /**
   * Update an existing opportunity
   */
  updateOpportunity(
    request: UpdateOpportunityRequest,
    context: AdapterContext
  ): Promise<Opportunity>;

  /**
   * Get an opportunity by ID
   */
  getOpportunity(id: string, context: AdapterContext): Promise<Opportunity>;

  /**
   * List opportunities with optional filtering
   */
  listOpportunities(
    filters?: {
      leadId?: string;
      pipelineId?: string;
      stage?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{ opportunities: Opportunity[]; total: number }>;

  /**
   * Get available pipelines
   */
  getPipelines(context: AdapterContext): Promise<Pipeline[]>;

  /**
   * Get a specific pipeline
   */
  getPipeline(id: string, context: AdapterContext): Promise<Pipeline>;
}

/**
 * Conversation Adapter - Manages multi-channel communications
 */
export interface IConversationAdapter {
  /**
   * Send a message in a conversation
   */
  sendMessage(
    request: SendMessageRequest,
    context: AdapterContext
  ): Promise<Message>;

  /**
   * List messages in a conversation
   */
  listMessages(
    conversationId: string,
    filters?: {
      limit?: number;
      offset?: number;
      since?: Date;
      type?: string;
    },
    context: AdapterContext
  ): Promise<{ messages: Message[]; total: number }>;

  /**
   * Get a conversation by ID
   */
  getConversation(id: string, context: AdapterContext): Promise<Conversation>;

  /**
   * List conversations with optional filtering
   */
  listConversations(
    filters?: {
      contactId?: string;
      channel?: string;
      status?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{ conversations: Conversation[]; total: number }>;

  /**
   * Tag a conversation
   */
  tagConversation(
    conversationId: string,
    tags: string[],
    context: AdapterContext
  ): Promise<Conversation>;

  /**
   * Update conversation status
   */
  updateConversationStatus(
    conversationId: string,
    status: 'active' | 'closed' | 'pending',
    context: AdapterContext
  ): Promise<Conversation>;
}

/**
 * Workflow Adapter - Manages automation and business processes
 */
export interface IWorkflowAdapter {
  /**
   * Trigger a workflow execution
   */
  triggerWorkflow(
    request: TriggerWorkflowRequest,
    context: AdapterContext
  ): Promise<WorkflowExecution>;

  /**
   * Pause a running workflow execution
   */
  pauseWorkflow(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution>;

  /**
   * Resume a paused workflow execution
   */
  resumeWorkflow(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution>;

  /**
   * Cancel a workflow execution
   */
  cancelWorkflow(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution>;

  /**
   * Get workflow execution status
   */
  getWorkflowExecution(
    executionId: string,
    context: AdapterContext
  ): Promise<WorkflowExecution>;

  /**
   * List workflow executions
   */
  listWorkflowExecutions(
    filters?: {
      workflowId?: string;
      contactId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{ executions: WorkflowExecution[]; total: number }>;

  /**
   * Get available workflows
   */
  getWorkflows(context: AdapterContext): Promise<Workflow[]>;

  /**
   * Get a specific workflow
   */
  getWorkflow(id: string, context: AdapterContext): Promise<Workflow>;
}

/**
 * Identity Adapter - Manages users and permissions
 */
export interface IIdentityAdapter {
  /**
   * List users with optional filtering
   */
  listUsers(
    filters?: {
      email?: string;
      role?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{ users: User[]; total: number }>;

  /**
   * Get a user by ID
   */
  getUser(id: string, context: AdapterContext): Promise<User>;

  /**
   * Get a user by email
   */
  getUserByEmail(email: string, context: AdapterContext): Promise<User>;

  /**
   * Map external user ID to NeuronX user
   * This helps correlate external system users with NeuronX users
   */
  mapExternalUser(
    externalId: string,
    context: AdapterContext
  ): Promise<User | null>;

  /**
   * Sync user permissions and roles
   */
  syncUserPermissions(userId: string, context: AdapterContext): Promise<User>;
}

/**
 * Calendar Adapter - Manages appointments and scheduling
 */
export interface ICalendarAdapter {
  /**
   * Create a calendar event
   */
  createEvent(
    event: {
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      contactId?: string;
      opportunityId?: string;
      assignedTo?: string;
      location?: string;
      attendees?: string[];
    },
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent>;

  /**
   * Update a calendar event
   */
  updateEvent(
    id: string,
    updates: Partial<{
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      status: string;
      location?: string;
      attendees?: string[];
    }>,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent>;

  /**
   * Get a calendar event
   */
  getEvent(
    id: string,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent>;

  /**
   * List calendar events
   */
  listEvents(
    filters?: {
      contactId?: string;
      opportunityId?: string;
      assignedTo?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{
    events: import('../domain/models').CalendarEvent[];
    total: number;
  }>;

  /**
   * Cancel a calendar event
   */
  cancelEvent(
    id: string,
    reason?: string,
    context: AdapterContext
  ): Promise<import('../domain/models').CalendarEvent>;
}

/**
 * Base Adapter Interface - Common functionality
 */
export interface IBaseAdapter {
  /**
   * Get adapter health status
   */
  getHealth(context: AdapterContext): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastChecked: Date;
  }>;

  /**
   * Get adapter capabilities
   */
  getCapabilities(): {
    name: string;
    version: string;
    supportedFeatures: string[];
    rateLimits?: {
      requestsPerMinute: number;
      burstLimit: number;
    };
  };

  /**
   * Validate adapter configuration
   */
  validateConfig(context: AdapterContext): Promise<{
    valid: boolean;
    errors?: string[];
  }>;
}

/**
 * Factory interface for creating adapters
 */
export interface IAdapterFactory {
  /**
   * Create a CRM adapter instance
   */
  createCRMAdapter(config: AdapterConfig): Promise<ICRMAdapter & IBaseAdapter>;

  /**
   * Create a conversation adapter instance
   */
  createConversationAdapter(
    config: AdapterConfig
  ): Promise<IConversationAdapter & IBaseAdapter>;

  /**
   * Create a workflow adapter instance
   */
  createWorkflowAdapter(
    config: AdapterConfig
  ): Promise<IWorkflowAdapter & IBaseAdapter>;

  /**
   * Create an identity adapter instance
   */
  createIdentityAdapter(
    config: AdapterConfig
  ): Promise<IIdentityAdapter & IBaseAdapter>;

  /**
   * Create a calendar adapter instance
   */
  createCalendarAdapter(
    config: AdapterConfig
  ): Promise<ICalendarAdapter & IBaseAdapter>;
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  tenantId: string;
  provider: string; // 'ghl', 'salesforce', 'hubspot', etc.
  environment: 'dev' | 'stage' | 'prod';
  credentials: Record<string, any>; // Encrypted in production
  options?: Record<string, any>;
}
