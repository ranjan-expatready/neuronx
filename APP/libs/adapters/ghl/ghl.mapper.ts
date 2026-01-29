// GHL to Canonical Domain Model Mappers
// Converts GHL-specific data structures to canonical NeuronX models

import {
  Lead,
  Opportunity,
  Pipeline,
  PipelineStage,
  Message,
  Conversation,
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  User,
  CalendarEvent,
  MessageAttachment,
} from '../domain/models';

import {
  GhlContact,
  GhlOpportunity,
  GhlPipeline,
  GhlPipelineStage,
  GhlMessage,
  GhlConversation,
  GhlWorkflow,
  GhlWorkflowStep,
  GhlWorkflowExecution,
  GhlUser,
  GhlCalendarEvent,
  GhlAttachment,
} from './ghl.types';

import {
  CanonicalOpportunityStage,
  StageTransitionValidator,
  StageValidationResult,
} from '@neuronx/pipeline';

export class GhlMapper {
  constructor(private readonly stageValidator?: StageTransitionValidator) {}

  // Contact/Lead mapping
  static mapContact(ghlContact: GhlContact, tenantId: string): Lead {
    return {
      id: ghlContact.id,
      tenantId,
      externalId: ghlContact.id,
      email: ghlContact.email,
      phone: ghlContact.phone,
      firstName: ghlContact.firstName,
      lastName: ghlContact.lastName,
      company: ghlContact.companyName,
      customFields: ghlContact.customFields || {},
      tags: ghlContact.tags || [],
      status: 'new', // GHL doesn't have lead status, default to new
      createdAt: new Date(ghlContact.dateAdded),
      updatedAt: new Date(ghlContact.dateUpdated),
    };
  }

  static mapContacts(ghlContacts: GhlContact[], tenantId: string): Lead[] {
    return ghlContacts.map(contact => this.mapContact(contact, tenantId));
  }

  static unmapLead(lead: Lead): Partial<GhlContact> {
    return {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      companyName: lead.company,
      tags: lead.tags,
      customFields: lead.customFields,
    };
  }

  static unmapLeadUpdate(updates: Partial<Lead>): Partial<GhlContact> {
    const ghlUpdates: Partial<GhlContact> = {};

    if (updates.firstName !== undefined)
      ghlUpdates.firstName = updates.firstName;
    if (updates.lastName !== undefined) ghlUpdates.lastName = updates.lastName;
    if (updates.email !== undefined) ghlUpdates.email = updates.email;
    if (updates.phone !== undefined) ghlUpdates.phone = updates.phone;
    if (updates.company !== undefined) ghlUpdates.companyName = updates.company;
    if (updates.tags !== undefined) ghlUpdates.tags = updates.tags;
    if (updates.customFields !== undefined)
      ghlUpdates.customFields = updates.customFields;

    return ghlUpdates;
  }

  // Opportunity mapping
  async mapOpportunity(
    ghlOpportunity: GhlOpportunity,
    tenantId: string,
    currentCanonicalStage?: CanonicalOpportunityStage
  ): Promise<Opportunity> {
    let canonicalStage: CanonicalOpportunityStage | null = null;

    if (this.stageValidator) {
      // Validate the stage mapping and transition
      const validationResult = await this.stageValidator.validate(
        tenantId,
        ghlOpportunity.pipelineId || 'default',
        currentCanonicalStage || null,
        ghlOpportunity.pipelineStageId,
        'ghl_webhook'
      );

      if (validationResult.allowed && validationResult.canonicalStage) {
        canonicalStage = validationResult.canonicalStage;
      } else {
        // Stage transition not allowed - map to current stage or default
        canonicalStage =
          currentCanonicalStage ||
          CanonicalOpportunityStage.PROSPECT_IDENTIFIED;
      }
    } else {
      // Fallback: no validator available, use default mapping
      canonicalStage = CanonicalOpportunityStage.PROSPECT_IDENTIFIED;
    }

    return {
      id: ghlOpportunity.id,
      tenantId,
      externalId: ghlOpportunity.id,
      leadId: ghlOpportunity.contactId,
      name: ghlOpportunity.name,
      value: ghlOpportunity.value,
      currency: ghlOpportunity.currency,
      stage: canonicalStage, // Use validated canonical stage
      pipelineId: ghlOpportunity.pipelineId,
      assignedTo: ghlOpportunity.assignedTo,
      customFields: ghlOpportunity.customFields || {},
      createdAt: new Date(ghlOpportunity.createdAt),
      updatedAt: new Date(ghlOpportunity.updatedAt),
    };
  }

  async mapOpportunities(
    ghlOpportunities: GhlOpportunity[],
    tenantId: string
  ): Promise<Opportunity[]> {
    const results: Opportunity[] = [];
    for (const opp of ghlOpportunities) {
      results.push(await this.mapOpportunity(opp, tenantId));
    }
    return results;
  }

  static unmapOpportunity(opportunity: Opportunity): any {
    return {
      contactId: opportunity.leadId,
      name: opportunity.name,
      value: opportunity.value,
      currency: opportunity.currency,
      pipelineId: opportunity.pipelineId,
      assignedTo: opportunity.assignedTo,
      customFields: opportunity.customFields,
    };
  }

  static unmapOpportunityUpdate(updates: Partial<Opportunity>): any {
    const ghlUpdates: any = {};

    if (updates.name !== undefined) ghlUpdates.name = updates.name;
    if (updates.value !== undefined) ghlUpdates.value = updates.value;
    if (updates.currency !== undefined) ghlUpdates.currency = updates.currency;
    if (updates.assignedTo !== undefined)
      ghlUpdates.assignedTo = updates.assignedTo;
    if (updates.customFields !== undefined)
      ghlUpdates.customFields = updates.customFields;

    return ghlUpdates;
  }

  // Pipeline mapping
  static mapPipeline(ghlPipeline: GhlPipeline, tenantId: string): Pipeline {
    return {
      id: ghlPipeline.id,
      tenantId,
      externalId: ghlPipeline.id,
      name: ghlPipeline.name,
      stages: ghlPipeline.stages.map(stage => this.mapPipelineStage(stage)),
      isActive: true, // GHL doesn't have pipeline status
      createdAt: new Date(), // GHL doesn't provide creation date
      updatedAt: new Date(),
    };
  }

  static mapPipelineStage(ghlStage: GhlPipelineStage): PipelineStage {
    return {
      id: ghlStage.id,
      name: ghlStage.name,
      order: ghlStage.order,
      // GHL doesn't have won/lost indicators in stage data
    };
  }

  static mapPipelines(
    ghlPipelines: GhlPipeline[],
    tenantId: string
  ): Pipeline[] {
    return ghlPipelines.map(pipeline => this.mapPipeline(pipeline, tenantId));
  }

  // Message mapping
  static mapMessage(ghlMessage: GhlMessage, tenantId: string): Message {
    return {
      id: ghlMessage.id,
      tenantId,
      externalId: ghlMessage.id,
      conversationId: ghlMessage.conversationId,
      content: ghlMessage.message,
      type: this.mapMessageType(ghlMessage.type),
      direction: ghlMessage.direction === 'inbound' ? 'inbound' : 'outbound',
      from: ghlMessage.from,
      to: ghlMessage.to,
      attachments:
        ghlMessage.attachments?.map(att => this.mapAttachment(att)) || [],
      metadata: {},
      createdAt: new Date(ghlMessage.createdAt),
      updatedAt: new Date(ghlMessage.createdAt),
    };
  }

  static mapMessageType(ghlType: string): 'text' | 'email' | 'sms' | 'voice' {
    switch (ghlType.toLowerCase()) {
      case 'email':
        return 'email';
      case 'sms':
        return 'sms';
      case 'voice':
      case 'call':
        return 'voice';
      default:
        return 'text';
    }
  }

  static mapAttachment(ghlAttachment: GhlAttachment): MessageAttachment {
    return {
      id: ghlAttachment.id,
      filename: ghlAttachment.filename,
      contentType: ghlAttachment.contentType,
      size: ghlAttachment.size,
      url: ghlAttachment.url,
    };
  }

  static mapMessages(ghlMessages: GhlMessage[], tenantId: string): Message[] {
    return ghlMessages.map(msg => this.mapMessage(msg, tenantId));
  }

  static unmapMessage(message: Message): any {
    return {
      conversationId: message.conversationId,
      message: message.content,
      type: this.unmapMessageType(message.type),
    };
  }

  static unmapMessageType(type: 'text' | 'email' | 'sms' | 'voice'): string {
    switch (type) {
      case 'email':
        return 'email';
      case 'sms':
        return 'sms';
      case 'voice':
        return 'voice';
      default:
        return 'text';
    }
  }

  // Conversation mapping
  static mapConversation(
    ghlConversation: GhlConversation,
    tenantId: string
  ): Conversation {
    return {
      id: ghlConversation.id,
      tenantId,
      externalId: ghlConversation.id,
      contactId: ghlConversation.contactId,
      channel: this.mapChannel(ghlConversation.channel),
      status: this.mapConversationStatus(ghlConversation.status),
      assignedTo: ghlConversation.assignedTo,
      lastMessageAt: ghlConversation.lastMessageAt
        ? new Date(ghlConversation.lastMessageAt)
        : undefined,
      tags: ghlConversation.tags || [],
      customFields: {},
      createdAt: new Date(ghlConversation.createdAt),
      updatedAt: new Date(ghlConversation.updatedAt),
    };
  }

  static mapChannel(
    ghlChannel: string
  ): 'email' | 'sms' | 'chat' | 'voice' | 'social' {
    switch (ghlChannel.toLowerCase()) {
      case 'email':
        return 'email';
      case 'sms':
        return 'sms';
      case 'chat':
      case 'facebook':
      case 'instagram':
        return 'social';
      case 'voice':
      case 'call':
        return 'voice';
      default:
        return 'chat';
    }
  }

  static mapConversationStatus(
    ghlStatus: string
  ): 'active' | 'closed' | 'pending' {
    switch (ghlStatus.toLowerCase()) {
      case 'active':
      case 'open':
        return 'active';
      case 'closed':
        return 'closed';
      case 'pending':
        return 'pending';
      default:
        return 'active';
    }
  }

  static mapConversations(
    ghlConversations: GhlConversation[],
    tenantId: string
  ): Conversation[] {
    return ghlConversations.map(conv => this.mapConversation(conv, tenantId));
  }

  // Workflow mapping
  static mapWorkflow(ghlWorkflow: GhlWorkflow, tenantId: string): Workflow {
    return {
      id: ghlWorkflow.id,
      tenantId,
      externalId: ghlWorkflow.id,
      name: ghlWorkflow.name,
      status: ghlWorkflow.status === 'active' ? 'active' : 'inactive',
      triggerType: ghlWorkflow.triggers?.[0]?.type || 'manual',
      triggerConditions: ghlWorkflow.triggers?.[0]?.conditions || {},
      steps: ghlWorkflow.steps.map(step => this.mapWorkflowStep(step)),
      isTemplate: false, // GHL doesn't distinguish templates
      createdAt: new Date(ghlWorkflow.createdAt),
      updatedAt: new Date(ghlWorkflow.updatedAt),
    };
  }

  static mapWorkflowStep(ghlStep: GhlWorkflowStep): WorkflowStep {
    return {
      id: ghlStep.id,
      type: ghlStep.type,
      name: ghlStep.name,
      config: ghlStep.config,
      order: ghlStep.order,
    };
  }

  static mapWorkflows(
    ghlWorkflows: GhlWorkflow[],
    tenantId: string
  ): Workflow[] {
    return ghlWorkflows.map(wf => this.mapWorkflow(wf, tenantId));
  }

  // Workflow Execution mapping
  static mapWorkflowExecution(
    ghlExecution: GhlWorkflowExecution,
    tenantId: string
  ): WorkflowExecution {
    return {
      id: ghlExecution.id,
      tenantId,
      externalId: ghlExecution.id,
      workflowId: ghlExecution.workflowId,
      contactId: ghlExecution.contactId,
      status: this.mapExecutionStatus(ghlExecution.status),
      currentStep: ghlExecution.currentStep,
      startedAt: new Date(ghlExecution.startedAt),
      completedAt: ghlExecution.completedAt
        ? new Date(ghlExecution.completedAt)
        : undefined,
      results: ghlExecution.results || {},
      createdAt: new Date(ghlExecution.startedAt),
      updatedAt: ghlExecution.completedAt
        ? new Date(ghlExecution.completedAt)
        : new Date(),
    };
  }

  static mapExecutionStatus(
    ghlStatus: string
  ): 'running' | 'completed' | 'failed' | 'paused' {
    switch (ghlStatus.toLowerCase()) {
      case 'running':
      case 'active':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      case 'paused':
        return 'paused';
      default:
        return 'running';
    }
  }

  // User mapping
  static mapUser(ghlUser: GhlUser, tenantId: string): User {
    return {
      id: ghlUser.id,
      tenantId,
      externalId: ghlUser.id,
      email: ghlUser.email,
      firstName: ghlUser.firstName,
      lastName: ghlUser.lastName,
      role: ghlUser.role,
      permissions: ghlUser.permissions,
      isActive: true, // Assume active if returned
      lastLoginAt: ghlUser.lastLogin ? new Date(ghlUser.lastLogin) : undefined,
      customFields: {},
      createdAt: new Date(ghlUser.createdAt),
      updatedAt: new Date(ghlUser.updatedAt),
    };
  }

  static mapUsers(ghlUsers: GhlUser[], tenantId: string): User[] {
    return ghlUsers.map(user => this.mapUser(user, tenantId));
  }

  // Calendar Event mapping
  static mapCalendarEvent(
    ghlEvent: GhlCalendarEvent,
    tenantId: string
  ): CalendarEvent {
    return {
      id: ghlEvent.id,
      tenantId,
      externalId: ghlEvent.id,
      title: ghlEvent.title,
      startTime: new Date(ghlEvent.startTime),
      endTime: new Date(ghlEvent.endTime),
      contactId: ghlEvent.contactId,
      assignedTo: ghlEvent.assignedTo,
      status: this.mapEventStatus(ghlEvent.status),
      attendees: ghlEvent.attendees || [],
      reminders: [], // GHL doesn't provide reminders in basic event data
      createdAt: new Date(ghlEvent.createdAt),
      updatedAt: new Date(ghlEvent.updatedAt),
    };
  }

  static mapEventStatus(
    ghlStatus: string
  ): 'scheduled' | 'confirmed' | 'completed' | 'cancelled' {
    switch (ghlStatus.toLowerCase()) {
      case 'scheduled':
        return 'scheduled';
      case 'confirmed':
        return 'confirmed';
      case 'completed':
      case 'done':
        return 'completed';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'scheduled';
    }
  }

  static mapCalendarEvents(
    ghlEvents: GhlCalendarEvent[],
    tenantId: string
  ): CalendarEvent[] {
    return ghlEvents.map(event => this.mapCalendarEvent(event, tenantId));
  }

  static unmapCalendarEvent(event: CalendarEvent): any {
    return {
      title: event.title,
      description: event.description,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      contactId: event.contactId,
      assignedTo: event.assignedTo,
      attendees: event.attendees,
    };
  }
}
