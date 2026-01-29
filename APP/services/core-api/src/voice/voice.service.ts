/**
 * Voice Service - REQ-001: Voice Control Plane Orchestration
 *
 * Voice orchestration layer with strict PAID → CaseOpen gating.
 * External voice systems treated as execution-only - this service emits intents ONLY.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../eventing';
import { DurableEventPublisherService } from '../eventing/durable-event-publisher';
import { ConfigLoader } from '../config/config.loader';
import { TenantContext } from '../config/tenant-context';
import { OpportunityService } from '../sales/opportunity.service';
import { PaymentService } from '../payments/payment.service';
import { AuditService } from '../audit/audit.service';
import { UsageService } from '../usage/usage.service';
import { UsageEventEmitter } from '../usage/usage.events';
import { VoiceAttemptRepository } from './voice-attempt.repository';

import {
  VoiceActionRequest,
  VoiceActionResult,
  VoiceConfiguration,
} from './voice.types';
import {
  VoicePolicyEngine,
  createDefaultVoiceConfig,
  validateVoiceConfiguration,
} from './voice.policy';
import { VoiceEventEmitter, VoiceEventValidator } from './voice.events';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly policyEngine = new VoicePolicyEngine();

  constructor(
    private readonly eventBus: EventBus,
    private readonly durableEventPublisher: DurableEventPublisherService,
    private readonly configLoader: ConfigLoader,
    private readonly opportunityService: OpportunityService,
    private readonly paymentService: PaymentService,
    private readonly auditService: AuditService,
    private readonly usageService: UsageService,
    private readonly voiceAttemptRepository: VoiceAttemptRepository
  ) {}

  /**
   * Request voice action - CRITICAL ENTRY POINT
   * This is the ONLY method to request voice actions.
   * Applies strict PAID → CaseOpen gating before allowing any voice intent emission.
   */
  async requestVoiceAction(
    request: VoiceActionRequest
  ): Promise<VoiceActionResult> {
    const { tenantId, opportunityId, actionType, channel, correlationId } =
      request;

    this.logger.log(`Processing voice action request`, {
      tenantId,
      opportunityId,
      actionType,
      channel,
      correlationId,
    });

    const startTime = Date.now();

    try {
      // Step 1: Load voice configuration for tenant
      const voiceConfig = await this.loadVoiceConfiguration(tenantId);

      // Step 2: Check opportunity state and payment verification
      const opportunityState = await this.checkOpportunityState(
        opportunityId,
        tenantId
      );
      const paymentVerified = this.paymentService.isPaymentVerifiedPaid(
        opportunityId,
        tenantId
      );

      // Step 3: Get current attempt count for this opportunity
      const attemptCount = this.getVoiceAttemptCount(opportunityId, tenantId);

      // Step 4: Evaluate voice authorization policy - CRITICAL GATING
      const policyResult = await this.policyEngine.evaluateAuthorization(
        request,
        opportunityState,
        paymentVerified,
        voiceConfig,
        attemptCount
      );

      // Step 5: Build authorization result
      const result: VoiceActionResult = {
        authorized: policyResult.allowed,
        reason: policyResult.reason,
        opportunityState: {
          currentState: opportunityState,
          isCaseOpen: opportunityState === 'case-open',
          paymentVerified,
        },
        voiceConfig,
        timestamp: new Date().toISOString(),
      };

      // Step 6: Emit audit event for authorization decision
      const auditEvent = VoiceEventEmitter.emitVoiceAuthorizationChecked(
        tenantId,
        opportunityId,
        actionType,
        result,
        correlationId
      );

      await this.eventBus.publish(auditEvent);

      // Audit: voice authorization checked
      await this.auditService.logEvent('voice.authorization.checked', {
        tenantId,
        opportunityId,
        actionType,
        channel,
        authorized: result.authorized,
        reason: result.reason,
        correlationId,
      });

      // Step 7: If authorized, create attempt record and emit voice intent for external execution
      if (policyResult.allowed) {
        const attemptId = await this.createVoiceAttempt(
          opportunityId,
          tenantId,
          actionType,
          channel,
          correlationId
        );

        await this.emitVoiceIntent(
          request,
          voiceConfig,
          correlationId,
          attemptId
        );
      } else {
        // Emit denial audit event
        const denialEvent = VoiceEventEmitter.emitVoiceActionDenied(
          tenantId,
          opportunityId,
          actionType,
          result,
          correlationId,
          {
            policyContext: policyResult.context,
          }
        );

        await this.eventBus.publish(denialEvent);

        this.logger.warn(`Voice action denied: ${policyResult.reason}`, {
          tenantId,
          opportunityId,
          actionType,
          channel,
          reason: policyResult.reason,
          correlationId,
        });
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Voice action request processed`, {
        tenantId,
        opportunityId,
        actionType,
        authorized: result.authorized,
        reason: result.reason,
        correlationId,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to process voice action request`, {
        tenantId,
        opportunityId,
        actionType,
        channel,
        error: error.message,
        correlationId,
      });

      // Return error result
      return {
        authorized: false,
        reason: 'denied_system_error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle provider webhook updates (idempotent)
   * Provider reports status changes - this is informational only,
   * doesn't override NeuronX authorization decisions
   */
  async handleProviderWebhook(
    tenantId: string,
    provider: string,
    providerCallId: string,
    status: string,
    metadata?: any,
    correlationId?: string
  ): Promise<boolean> {
    try {
      // Update attempt from provider data (idempotent by provider + providerCallId)
      const attemptId = await this.voiceAttemptRepository.updateFromProvider({
        tenantId,
        provider,
        providerCallId,
        providerStatus: status,
        durationSec: metadata?.duration,
        recordingUrl: metadata?.recordingUrl,
        transcriptRef: metadata?.transcriptRef,
        correlationId: correlationId || `webhook-${providerCallId}`,
      });

      if (attemptId) {
        // Create execution event for webhook update
        await this.voiceAttemptRepository.createExecutionEvent({
          tenantId,
          attemptId,
          eventType: 'webhook.update',
          payloadJson: {
            provider,
            providerCallId,
            status,
            metadata,
          },
          correlationId: correlationId || `webhook-${providerCallId}`,
          idempotencyKey: `webhook-${provider}-${providerCallId}-${status}`,
        });

        // Publish webhook event via outbox
        await this.durableEventPublisher.publishAsync({
          tenantId,
          eventId: `voice-webhook-${attemptId}-${Date.now()}`,
          eventType: 'voice.webhook.received',
          payload: {
            attemptId,
            provider,
            providerCallId,
            status,
            metadata,
          },
          correlationId: correlationId || `webhook-${providerCallId}`,
          idempotencyKey: `voice-webhook-${provider}-${providerCallId}`,
          sourceService: 'voice-service',
        });

        this.logger.debug(`Processed voice webhook for attempt: ${attemptId}`, {
          tenantId,
          provider,
          providerCallId,
          status,
        });

        return true;
      }

      return false; // No attempt found
    } catch (error: any) {
      this.logger.error(`Failed to process voice webhook`, {
        tenantId,
        provider,
        providerCallId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Link voice attempt to case (only after CaseOpened)
   * This completes the authorization gate sequence
   */
  async linkAttemptToCase(
    tenantId: string,
    attemptId: string,
    caseRef: string,
    correlationId: string
  ): Promise<void> {
    await this.voiceAttemptRepository.linkToCase(
      tenantId,
      attemptId,
      caseRef,
      correlationId
    );

    // Create execution event for case linkage
    await this.voiceAttemptRepository.createExecutionEvent({
      tenantId,
      attemptId,
      eventType: 'case.linked',
      payloadJson: {
        caseRef,
      },
      correlationId,
      idempotencyKey: `case-link-${attemptId}`,
    });

    // Publish case linkage event via outbox
    await this.durableEventPublisher.publishAsync({
      tenantId,
      eventId: `voice-case-link-${attemptId}`,
      eventType: 'voice.case.linked',
      payload: {
        attemptId,
        caseRef,
      },
      correlationId,
      idempotencyKey: `voice-case-link-${attemptId}`,
      sourceService: 'voice-service',
    });

    this.logger.debug(`Linked voice attempt to case: ${attemptId}`, {
      tenantId,
      caseRef,
      correlationId,
    });
  }

  /**
   * Load voice configuration for tenant
   * Falls back to secure defaults if configuration is invalid or missing
   */
  private async loadVoiceConfiguration(
    tenantId: string
  ): Promise<VoiceConfiguration> {
    try {
      // Create tenant context
      const tenantContext = { tenantId, environment: 'prod' as const };

      // Load configuration
      const config = await this.configLoader.loadConfig(
        'neuronx-config',
        tenantContext
      );

      if (!config) {
        this.logger.warn(
          `No configuration found for tenant ${tenantId}, using defaults`
        );
        return createDefaultVoiceConfig();
      }

      // Extract voice configuration
      const voiceConfig = config.domains?.voice;

      if (!voiceConfig) {
        this.logger.warn(
          `No voice configuration found for tenant ${tenantId}, using defaults`
        );
        return createDefaultVoiceConfig();
      }

      // Validate configuration
      const validation = validateVoiceConfiguration(voiceConfig);
      if (!validation.valid) {
        this.logger.warn(
          `Invalid voice configuration for tenant ${tenantId}, using defaults`,
          {
            errors: validation.errors,
          }
        );
        return createDefaultVoiceConfig();
      }

      return voiceConfig;
    } catch (error) {
      this.logger.error(
        `Failed to load voice configuration for tenant ${tenantId}`,
        {
          error: error.message,
        }
      );

      // Always fall back to secure defaults on any error
      return createDefaultVoiceConfig();
    }
  }

  /**
   * Check opportunity state
   * Determines if opportunity is in CaseOpen state
   */
  private async checkOpportunityState(
    opportunityId: string,
    tenantId: string
  ): Promise<string> {
    try {
      const isCaseOpen = await this.opportunityService.isOpportunityCaseOpen(
        opportunityId,
        tenantId
      );
      return isCaseOpen ? 'case-open' : 'unknown'; // Simplified - in real implementation would get actual state
    } catch (error) {
      this.logger.warn(
        `Failed to check opportunity state for ${opportunityId}`,
        {
          tenantId,
          opportunityId,
          error: error.message,
        }
      );
      return 'unknown';
    }
  }

  /**
   * Get voice attempt count for opportunity
   * Tracks how many voice actions have been attempted for this case
   */
  private getVoiceAttemptCount(
    opportunityId: string,
    tenantId: string
  ): number {
    const key = `${tenantId}:${opportunityId}`;
    const record = this.voiceAttempts.get(key);
    return record?.attemptCount || 0;
  }

  /**
   * Record voice attempt
   * Tracks attempt count and timing for policy enforcement
   */
  /**
   * Create durable voice attempt record
   */
  private async createVoiceAttempt(
    opportunityId: string,
    tenantId: string,
    actionType: string,
    channel: string,
    correlationId: string
  ): Promise<string> {
    const attemptId = crypto.randomUUID();

    // Get existing attempts for this lead to determine attempt count
    const existingAttempts =
      await this.voiceAttemptRepository.queryAttemptsByLead(
        tenantId,
        opportunityId,
        100
      );

    const attemptCount = existingAttempts.length + 1;

    // Create durable attempt record
    await this.voiceAttemptRepository.createAttempt({
      tenantId,
      attemptId,
      leadId: opportunityId,
      intentType: `${actionType}_${channel}`,
      correlationId,
      idempotencyKey: `${correlationId}-${opportunityId}-${attemptCount}`,
      provider: 'default', // Could be made configurable
      maxRetries: 3,
    });

    // Create execution event for attempt started
    await this.voiceAttemptRepository.createExecutionEvent({
      tenantId,
      attemptId,
      eventType: 'attempt.started',
      payloadJson: {
        opportunityId,
        actionType,
        channel,
        attemptCount,
      },
      correlationId,
      idempotencyKey: `attempt-started-${attemptId}`,
    });

    return attemptId;
  }

  /**
   * Emit voice intent event - CRITICAL EXECUTION TRIGGER
   * This is the ONLY event that signals voice action readiness.
   * External voice systems consume this event to perform actual voice operations.
   */
  private async emitVoiceIntent(
    request: VoiceActionRequest,
    voiceConfig: VoiceConfiguration,
    correlationId: string,
    attemptId: string
  ): Promise<void> {
    const { tenantId, opportunityId, actionType, channel } = request;

    // Mark attempt as authorized (NeuronX-owned decision)
    await this.voiceAttemptRepository.authorizeAttempt(
      tenantId,
      attemptId,
      'consent-ref-placeholder', // Would come from actual consent check
      'payment-ref-placeholder', // Would come from actual payment verification
      correlationId
    );

    // Create voice intent event
    const intentEvent = VoiceEventEmitter.emitVoiceIntentAuthorized(
      tenantId,
      opportunityId,
      actionType,
      channel,
      voiceConfig,
      correlationId
    );

    // Validate event before emission (security check)
    const validation =
      VoiceEventValidator.validateVoiceIntentEvent(intentEvent);
    if (!validation.valid) {
      throw new Error(
        `Invalid voice intent event: ${validation.errors.join(', ')}`
      );
    }

    // Emit the intent event durably via outbox - external systems will consume this
    await this.durableEventPublisher.publishAsync({
      tenantId,
      eventId: intentEvent.eventId,
      eventType: intentEvent.type,
      payload: intentEvent.payload,
      correlationId,
      idempotencyKey: `voice-intent-${attemptId}`,
      sourceService: 'voice-service',
    });

    this.logger.log(`Voice intent emitted for external execution`, {
      tenantId,
      opportunityId,
      attemptId,
      actionType,
      channel,
      intentEventId: intentEvent.eventId,
      correlationId,
    });

    // Audit: voice intent emitted
    await this.auditService.logEvent('voice.intent.emitted', {
      tenantId,
      opportunityId,
      actionType,
      channel,
      intentEventId: intentEvent.eventId,
      correlationId,
    });

    // Emit usage events for metering - track authorized voice minutes
    try {
      // Estimate minutes based on action type and config
      let estimatedMinutes = voiceConfig.maxCallDurationMinutes || 30;

      // Different action types may have different durations
      switch (actionType) {
        case 'follow_up_call':
          estimatedMinutes = Math.min(estimatedMinutes, 10); // Shorter follow-ups
          break;
        case 'escalation_call':
          estimatedMinutes = Math.min(estimatedMinutes, 15); // Medium escalation calls
          break;
        case 'outbound_call':
        case 'inbound_response':
        default:
          // Use full configured duration
          break;
      }

      const voiceEvent = UsageEventEmitter.emitVoiceMinutesAuthorized(
        tenantId,
        estimatedMinutes,
        intentEvent.eventId, // Use intent event ID as call ID
        correlationId,
        'voice'
      );
      await this.usageService.recordUsage(voiceEvent);
    } catch (error) {
      // Log but don't fail the voice intent emission
      this.logger.warn(
        `Failed to emit voice usage event for ${opportunityId}`,
        {
          tenantId,
          error: error.message,
          correlationId,
        }
      );
    }
  }

  /**
   * Get voice configuration for tenant (admin/debugging)
   */
  async getVoiceConfiguration(tenantId: string): Promise<VoiceConfiguration> {
    return this.loadVoiceConfiguration(tenantId);
  }

  /**
   * Get voice attempt history for opportunity (admin/debugging)
   */
  async getVoiceAttemptHistory(
    opportunityId: string,
    tenantId: string
  ): Promise<any[]> {
    return this.voiceAttemptRepository.queryAttemptsByLead(
      tenantId,
      opportunityId
    );
  }

  /**
   * Clear voice attempt history (for testing only)
   */
  async clearVoiceAttemptHistory(tenantId: string): Promise<void> {
    // Replaced by repository cleanup
    await this.voiceAttemptRepository.cleanupOldAttempts(0);
  }
}
