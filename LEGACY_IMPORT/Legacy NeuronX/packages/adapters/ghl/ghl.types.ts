// GHL-specific types - NEVER exported from this package
// These are internal implementation details only

export interface GhlContact {
  id: string;
  locationId: string;
  contactName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  dateAdded: string;
  dateUpdated: string;
}

export interface GhlOpportunity {
  id: string;
  locationId: string;
  contactId: string;
  name: string;
  status: string;
  pipelineId: string;
  pipelineStageId: string;
  assignedTo?: string;
  value?: number;
  currency?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface GhlPipeline {
  id: string;
  locationId: string;
  name: string;
  stages: GhlPipelineStage[];
}

export interface GhlPipelineStage {
  id: string;
  name: string;
  order: number;
}

export interface GhlMessage {
  id: string;
  conversationId: string;
  message: string;
  type: string;
  direction: string;
  from: string;
  to: string;
  attachments?: GhlAttachment[];
  createdAt: string;
}

export interface GhlAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
}

export interface GhlConversation {
  id: string;
  locationId: string;
  contactId: string;
  status: string;
  channel: string;
  assignedTo?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GhlWorkflow {
  id: string;
  locationId: string;
  name: string;
  status: string;
  triggers: GhlWorkflowTrigger[];
  steps: GhlWorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface GhlWorkflowTrigger {
  type: string;
  conditions?: Record<string, any>;
}

export interface GhlWorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
  order: number;
}

export interface GhlWorkflowExecution {
  id: string;
  workflowId: string;
  contactId?: string;
  status: string;
  currentStep?: string;
  startedAt: string;
  completedAt?: string;
  results?: Record<string, any>;
}

export interface GhlUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  permissions: string[];
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GhlCalendarEvent {
  id: string;
  locationId: string;
  title: string;
  startTime: string;
  endTime: string;
  contactId?: string;
  assignedTo?: string;
  status: string;
  attendees?: string[];
  createdAt: string;
  updatedAt: string;
}

// API Response wrappers
export interface GhlApiResponse<T> {
  data?: T;
  contacts?: T[];
  opportunities?: T[];
  conversations?: T[];
  workflows?: T[];
  users?: T[];
  events?: T[];
  total?: number;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Error responses
export interface GhlApiError {
  error: string;
  message: string;
  code?: string;
  details?: any;
}

// Token response
export interface GhlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  companyId: string;
  locationIds: string[];
  scope: string;
}

// Webhook payload
export interface GhlWebhookPayload {
  event: string;
  locationId: string;
  companyId: string;
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}
