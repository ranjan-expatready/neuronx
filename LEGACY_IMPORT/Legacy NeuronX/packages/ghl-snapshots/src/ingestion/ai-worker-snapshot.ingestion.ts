/**
 * AI Worker Snapshot Ingestion - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Ingests GHL AI worker configurations for read-only mirroring.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BaseSnapshotIngestion } from './base-snapshot.ingestion';
import { SnapshotType } from '../snapshot-types';

@Injectable()
export class AiWorkerSnapshotIngestion extends BaseSnapshotIngestion {
  constructor(prisma: PrismaClient) {
    super(prisma, 'AiWorkerSnapshotIngestion');
  }

  /**
   * Ingest GHL AI workers snapshot
   */
  async ingest(tenantId: string, ghlAccountId: string, correlationId: string) {
    try {
      this.logger.debug(`Starting AI worker snapshot ingestion`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Fetch AI workers from GHL
      const aiWorkers = await this.fetchFromGhl(tenantId, ghlAccountId);

      this.logger.debug(`Fetched ${aiWorkers.length} AI workers`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Create snapshot
      return this.createSnapshot(
        tenantId,
        ghlAccountId,
        SnapshotType.AI_WORKERS,
        aiWorkers,
        correlationId
      );
    } catch (error) {
      return this.handleIngestionError(
        tenantId,
        ghlAccountId,
        SnapshotType.AI_WORKERS,
        error,
        correlationId
      );
    }
  }

  /**
   * Fetch AI workers from GHL API
   */
  protected async fetchFromGhl(
    _tenantId: string,
    _ghlAccountId: string
  ): Promise<any[]> {
    // In a real implementation, this would fetch AI worker configurations
    // including prompts, models, conversation settings, and usage limits

    return [
      {
        id: 'aiw_001',
        name: 'Sales Qualification Bot',
        description: 'AI assistant for initial lead qualification',
        type: 'conversational',
        model: 'gpt-4',
        status: 'active',
        configuration: {
          systemPrompt: `You are a professional sales qualification assistant.
          Your goal is to gather key information about potential customers
          and determine if they are a good fit for our services.`,
          conversationSettings: {
            maxTurns: 10,
            timeoutMinutes: 30,
            fallbackToHuman: true,
            humanEscalationTriggers: [
              'complaint',
              'refund_request',
              'technical_issue',
            ],
          },
          knowledgeBase: {
            productInfo: true,
            pricing: true,
            competitorInfo: false,
            internalPolicies: true,
          },
          responseGuidelines: {
            tone: 'professional',
            maxResponseLength: 500,
            includeEmojis: false,
            useCompanyBranding: true,
          },
        },
        capabilities: [
          'lead_qualification',
          'information_gathering',
          'appointment_scheduling',
          'objection_handling',
        ],
        integrations: {
          calendar: {
            enabled: true,
            calendarId: 'cal_001',
          },
          crm: {
            enabled: true,
            autoCreateContacts: true,
            autoUpdateLeads: true,
          },
          email: {
            enabled: true,
            signatureTemplate: 'sales_signature',
          },
        },
        limits: {
          monthlyConversations: 1000,
          monthlyMessages: 5000,
          concurrentChats: 5,
          rateLimitPerMinute: 10,
        },
        analytics: {
          totalConversations: 450,
          averageRating: 4.2,
          conversionRate: 0.15,
          averageResponseTime: 45, // seconds
          humanEscalations: 25,
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        // Preserve all GHL AI worker fields for forward compatibility
        customFields: {},
        trainingData: {
          lastTrained: '2024-01-01T00:00:00Z',
          trainingExamples: 1500,
          modelVersion: 'v2.1',
        },
        safetySettings: {
          contentFiltering: 'strict',
          piiDetection: true,
          hallucinationPrevention: true,
        },
      },
      {
        id: 'aiw_002',
        name: 'Support Chat Bot',
        description: 'AI assistant for basic customer support inquiries',
        type: 'faq',
        model: 'gpt-3.5-turbo',
        status: 'active',
        configuration: {
          systemPrompt: `You are a helpful customer support assistant.
          Provide accurate answers to common questions and escalate
          complex issues to human support.`,
          conversationSettings: {
            maxTurns: 15,
            timeoutMinutes: 60,
            fallbackToHuman: true,
            humanEscalationTriggers: [
              'account_issue',
              'billing_problem',
              'escalation_requested',
            ],
          },
          knowledgeBase: {
            faqDocuments: true,
            troubleshootingGuides: true,
            productManuals: true,
            internalKnowledge: false,
          },
          responseGuidelines: {
            tone: 'helpful',
            maxResponseLength: 300,
            includeEmojis: true,
            useCompanyBranding: true,
          },
        },
        capabilities: [
          'faq_answering',
          'troubleshooting',
          'ticket_creation',
          'knowledge_search',
        ],
        integrations: {
          helpdesk: {
            enabled: true,
            autoCreateTickets: true,
            ticketCategories: ['technical', 'billing', 'general'],
          },
          crm: {
            enabled: true,
            autoCreateContacts: false,
            autoUpdateLeads: false,
          },
        },
        limits: {
          monthlyConversations: 2000,
          monthlyMessages: 10000,
          concurrentChats: 10,
          rateLimitPerMinute: 20,
        },
        analytics: {
          totalConversations: 1200,
          averageRating: 4.5,
          resolutionRate: 0.75,
          averageResponseTime: 30,
          humanEscalations: 180,
        },
        createdAt: '2023-02-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        customFields: {},
        trainingData: {
          lastTrained: '2024-01-01T00:00:00Z',
          trainingExamples: 800,
          modelVersion: 'v1.8',
        },
        safetySettings: {
          contentFiltering: 'moderate',
          piiDetection: true,
          hallucinationPrevention: true,
        },
      },
      {
        id: 'aiw_003',
        name: 'Appointment Scheduler',
        description: 'AI assistant for booking appointments and meetings',
        type: 'scheduling',
        model: 'gpt-4',
        status: 'active',
        configuration: {
          systemPrompt: `You are an efficient appointment scheduling assistant.
          Help customers book meetings and manage their calendar availability.`,
          conversationSettings: {
            maxTurns: 8,
            timeoutMinutes: 15,
            fallbackToHuman: false,
            humanEscalationTriggers: [],
          },
          knowledgeBase: {
            calendarAvailability: true,
            appointmentTypes: true,
            schedulingPolicies: true,
          },
          responseGuidelines: {
            tone: 'efficient',
            maxResponseLength: 200,
            includeEmojis: false,
            useCompanyBranding: true,
          },
        },
        capabilities: [
          'appointment_booking',
          'availability_checking',
          'rescheduling',
          'cancellation_handling',
        ],
        integrations: {
          calendar: {
            enabled: true,
            calendarId: 'cal_001',
          },
          crm: {
            enabled: true,
            autoCreateContacts: true,
            autoUpdateLeads: false,
          },
        },
        limits: {
          monthlyConversations: 500,
          monthlyMessages: 2000,
          concurrentChats: 3,
          rateLimitPerMinute: 5,
        },
        analytics: {
          totalConversations: 280,
          averageRating: 4.8,
          bookingSuccessRate: 0.95,
          averageResponseTime: 15,
          humanEscalations: 0,
        },
        createdAt: '2023-03-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        customFields: {},
        trainingData: {
          lastTrained: '2024-01-01T00:00:00Z',
          trainingExamples: 300,
          modelVersion: 'v1.5',
        },
        safetySettings: {
          contentFiltering: 'minimal',
          piiDetection: true,
          hallucinationPrevention: false,
        },
      },
    ];
  }
}
