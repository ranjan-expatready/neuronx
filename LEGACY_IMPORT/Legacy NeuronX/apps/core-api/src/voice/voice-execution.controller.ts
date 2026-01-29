/**
 * Voice Execution Controller - WI-033: Voice Execution Adapter Hardening
 *
 * REST endpoints for voice execution with Twilio integration.
 */

import {
  Controller,
  Post,
  Body,
  Logger,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { TenantContext } from '../config/tenant-context';
import { AuditService } from '../audit/audit.service';
import { PlaybookEnforcer } from '@neuronx/playbook-engine';
import { DecisionEngine } from '@neuronx/decision-engine';
import {
  TwilioVoiceExecutionAdapter,
  VoiceExecutionContext,
  VoiceExecutionReceipt,
} from '@neuronx/voice-twilio';
import { ExecutionCommand } from '@neuronx/playbook-engine';
import { generateCorrelationId } from '../../lib/utils';

@Controller('voice')
export class VoiceExecutionController {
  private readonly logger = new Logger(VoiceExecutionController.name);
  private twilioAdapter: TwilioVoiceExecutionAdapter;

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContext,
    private readonly auditService: AuditService,
    private readonly playbookEnforcer: PlaybookEnforcer,
    private readonly decisionEngine: DecisionEngine
  ) {
    this.initializeTwilioAdapter();
  }

  private async initializeTwilioAdapter() {
    const voiceConfig = await this.configService.getVoiceConfig(
      this.tenantContext.tenantId
    );
    this.twilioAdapter = new TwilioVoiceExecutionAdapter(voiceConfig);
  }

  /**
   * Execute voice command (internal API for NeuronX runners)
   * POST /api/voice/execute
   */
  @Post('execute')
  async executeVoice(
    @Body() body: { executionCommand: ExecutionCommand; correlationId?: string }
  ) {
    const correlationId = body.correlationId || generateCorrelationId();
    const tenantId = this.tenantContext.tenantId;

    this.logger.log(
      `Voice execution requested for opportunity ${body.executionCommand.opportunityId}`,
      {
        correlationId,
        tenantId,
        commandType: body.executionCommand.commandType,
      }
    );

    try {
      // Get decision for this execution
      const decisionResult = await this.decisionEngine.evaluateExecution({
        tenantId,
        opportunityId: body.executionCommand.opportunityId,
        stage: body.executionCommand.stageId as any, // TODO: Fix type
        executionCommand: body.executionCommand,
        dealValue: 0, // TODO: Get from opportunity
        customerRiskScore: 50, // TODO: Calculate properly
        slaUrgency: 'normal',
        retryCount: 0,
        evidenceSoFar: [],
        playbookVersion: '1.0.0',
        correlationId,
      });

      // Create execution context
      const context: VoiceExecutionContext = {
        executionCommand: body.executionCommand,
        decisionResult,
        tenantId,
        correlationId,
        attemptNumber: 1,
        maxRetries: 3,
        previousOutcomes: [],
      };

      // Execute with enforcement
      const receipt = await this.twilioAdapter.executeVoiceCommand(context);

      // Audit the execution attempt
      await this.auditService.logEvent({
        eventType: 'voice_execution_attempted',
        tenantId,
        userId: 'system',
        resourceId: body.executionCommand.opportunityId,
        resourceType: 'opportunity',
        action: 'voice_call_initiated',
        details: {
          commandType: body.executionCommand.commandType,
          decisionAllowed: decisionResult.allowed,
          callSid: receipt.callSid,
          status: receipt.status,
          correlationId,
        },
        metadata: {
          voiceMode: decisionResult.voiceMode,
          actor: decisionResult.actor,
        },
      });

      return {
        success: receipt.status !== 'rejected' && receipt.status !== 'failed',
        receipt,
        correlationId,
      };
    } catch (error) {
      this.logger.error(`Voice execution failed: ${error.message}`, {
        correlationId,
        tenantId,
        error: error.stack,
      });

      await this.auditService.logEvent({
        eventType: 'voice_execution_failed',
        tenantId,
        userId: 'system',
        resourceId: body.executionCommand.opportunityId,
        resourceType: 'opportunity',
        action: 'voice_call_failed',
        details: {
          error: error.message,
          correlationId,
        },
      });

      return {
        success: false,
        error: error.message,
        correlationId,
      };
    }
  }

  /**
   * Twilio status callback webhook
   * POST /api/voice/twilio/status-callback
   */
  @Post('twilio/status-callback')
  async twilioStatusCallback(@Body() payload: any) {
    const correlationId = generateCorrelationId();

    this.logger.log(
      `Twilio status callback received for call ${payload.CallSid}`,
      {
        correlationId,
        callStatus: payload.CallStatus,
        callSid: payload.CallSid,
      }
    );

    try {
      // Process the callback through the adapter
      const result = await this.twilioAdapter.processStatusCallback(payload);

      // Normalize evidence and feed to playbook engine
      for (const evidence of result.evidenceEvents) {
        await this.playbookEnforcer.evaluateStageTransition({
          tenantId: evidence.tenantId || this.tenantContext.tenantId,
          opportunityId: evidence.opportunityId,
          playbookId: evidence.playbookId,
          currentStage: evidence.stageId as any, // TODO: Fix type
          evidence: [
            {
              evidenceType: evidence.evidenceType,
              data: evidence.data,
              source: evidence.source,
              confidence: evidence.confidence,
              correlationId: evidence.correlationId,
            },
          ],
          correlationId: evidence.correlationId,
        });
      }

      // Audit the callback processing
      await this.auditService.logEvent({
        eventType: 'voice_callback_processed',
        tenantId: this.tenantContext.tenantId,
        userId: 'system',
        resourceId: payload.CallSid,
        resourceType: 'voice_call',
        action: 'callback_processed',
        details: {
          callSid: payload.CallSid,
          callStatus: payload.CallStatus,
          evidenceCount: result.evidenceEvents.length,
          finalEvidence: result.finalEvidence,
          correlationId,
        },
      });

      return { success: true, correlationId };
    } catch (error) {
      this.logger.error(`Twilio callback processing failed: ${error.message}`, {
        correlationId,
        callSid: payload.CallSid,
        error: error.stack,
      });

      await this.auditService.logEvent({
        eventType: 'voice_callback_failed',
        tenantId: this.tenantContext.tenantId,
        userId: 'system',
        resourceId: payload.CallSid,
        resourceType: 'voice_call',
        action: 'callback_processing_failed',
        details: {
          error: error.message,
          correlationId,
        },
      });

      return { success: false, error: error.message, correlationId };
    }
  }

  /**
   * Twilio recording callback webhook
   * POST /api/voice/twilio/recording-callback
   */
  @Post('twilio/recording-callback')
  async twilioRecordingCallback(@Body() payload: any) {
    const correlationId = generateCorrelationId();

    this.logger.log(
      `Twilio recording callback received for call ${payload.CallSid}`,
      {
        correlationId,
        recordingSid: payload.RecordingSid,
      }
    );

    try {
      await this.twilioAdapter.processRecordingCallback(payload);

      await this.auditService.logEvent({
        eventType: 'voice_recording_processed',
        tenantId: this.tenantContext.tenantId,
        userId: 'system',
        resourceId: payload.RecordingSid,
        resourceType: 'voice_recording',
        action: 'recording_callback_processed',
        details: {
          callSid: payload.CallSid,
          recordingSid: payload.RecordingSid,
          duration: payload.RecordingDuration,
          correlationId,
        },
      });

      return { success: true, correlationId };
    } catch (error) {
      this.logger.error(
        `Recording callback processing failed: ${error.message}`,
        {
          correlationId,
          recordingSid: payload.RecordingSid,
          error: error.stack,
        }
      );

      return { success: false, error: error.message, correlationId };
    }
  }

  /**
   * Get voice execution capabilities
   * GET /api/voice/capabilities
   */
  @Get('capabilities')
  async getCapabilities() {
    const capabilities = this.twilioAdapter.getCapabilities();

    return {
      success: true,
      capabilities,
      provider: 'twilio',
    };
  }

  /**
   * Get safety violations (for monitoring)
   * GET /api/voice/safety-violations
   */
  @Get('safety-violations')
  async getSafetyViolations(@Query('limit') limit = 50) {
    const violations = this.twilioAdapter
      .getSafetyViolations()
      .slice(-limit) // Get most recent violations
      .reverse(); // Most recent first

    return {
      success: true,
      violations,
      total: violations.length,
    };
  }
}
