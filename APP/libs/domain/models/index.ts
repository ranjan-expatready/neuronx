// Canonical domain models for NeuronX
// These represent the business concepts, not vendor implementations

// Export sales state machine types
export * from './sales-state.types';
export { SalesStateMachine } from './sales-state-machine';

// Export services
export * from '../services';

export interface BaseEntity {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead extends BaseEntity {
  externalId?: string; // ID from external system
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customFields: Record<string, any>;
  tags: string[];
  source?: string;
  score?: number;
  status: 'new' | 'contacted' | 'qualified' | 'disqualified';
}

export interface Opportunity extends BaseEntity {
  externalId?: string;
  leadId: string;
  name: string;
  description?: string;
  value?: number;
  currency?: string;
  stage: string;
  pipelineId: string;
  assignedTo?: string; // User ID
  expectedCloseDate?: Date;
  customFields: Record<string, any>;
}

export interface Pipeline extends BaseEntity {
  externalId?: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  isActive: boolean;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
}

export interface Message extends BaseEntity {
  externalId?: string;
  conversationId: string;
  content: string;
  type: 'text' | 'email' | 'sms' | 'voice';
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  attachments?: MessageAttachment[];
  metadata: Record<string, any>;
}

export interface MessageAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
}

export interface Conversation extends BaseEntity {
  externalId?: string;
  contactId: string;
  channel: 'email' | 'sms' | 'chat' | 'voice' | 'social';
  status: 'active' | 'closed' | 'pending';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  lastMessageAt?: Date;
  tags: string[];
  customFields: Record<string, any>;
}

export interface Workflow extends BaseEntity {
  externalId?: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConditions: Record<string, any>;
  steps: WorkflowStep[];
  status: 'active' | 'inactive' | 'draft';
  isTemplate: boolean;
}

export interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  order: number;
  conditions?: WorkflowCondition[];
}

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: any;
}

export interface WorkflowExecution extends BaseEntity {
  externalId?: string;
  workflowId: string;
  contactId?: string;
  opportunityId?: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  results: Record<string, any>;
}

export interface User extends BaseEntity {
  externalId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt?: Date;
  customFields: Record<string, any>;
}

export interface CalendarEvent extends BaseEntity {
  externalId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  contactId?: string;
  opportunityId?: string;
  assignedTo?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  location?: string;
  attendees: string[];
  reminders: CalendarReminder[];
}

export interface CalendarReminder {
  type: 'email' | 'sms';
  minutesBefore: number;
  sent: boolean;
}

// Request/Response types for adapter operations
export interface CreateLeadRequest {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  source?: string;
}

export interface UpdateLeadRequest {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  status?: string;
}

export interface CreateOpportunityRequest {
  leadId: string;
  name: string;
  description?: string;
  value?: number;
  currency?: string;
  pipelineId: string;
  assignedTo?: string;
  expectedCloseDate?: Date;
  customFields?: Record<string, any>;
}

export interface UpdateOpportunityRequest {
  id: string;
  name?: string;
  description?: string;
  value?: number;
  currency?: string;
  stage?: string;
  assignedTo?: string;
  expectedCloseDate?: Date;
  customFields?: Record<string, any>;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  type: 'text' | 'email' | 'sms';
  attachments?: MessageAttachment[];
}

export interface TriggerWorkflowRequest {
  workflowId: string;
  contactId?: string;
  opportunityId?: string;
  triggerData?: Record<string, any>;
}

// Common adapter operation context
export interface AdapterContext {
  tenantId: string;
  correlationId: string;
  userId?: string;
  requestId: string;
}

// Error types
export class AdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class ValidationError extends AdapterError {
  constructor(field: string, message: string) {
    super(
      'VALIDATION_ERROR',
      `Validation failed for ${field}: ${message}`,
      400,
      false
    );
  }
}

export class NotFoundError extends AdapterError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404, false);
  }
}

export class RateLimitError extends AdapterError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMIT', 'Rate limit exceeded', 429, true);
    this.retryAfter = retryAfterSeconds;
  }
  retryAfter: number;
}

export class AuthenticationError extends AdapterError {
  constructor(message: string = 'Authentication failed') {
    super('AUTHENTICATION_ERROR', message, 401, false);
  }
}

export class AuthorizationError extends AdapterError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403, false);
  }
}
