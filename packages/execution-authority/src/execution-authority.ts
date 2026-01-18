/**
 * Execution Authority - WI-034: Multi-Channel Execution Authority
 *
 * Main orchestration service for multi-channel execution planning and token management.
 */

import {
  ExecutionAuthority,
  ExecutionContext,
  ExecutionPlan,
  ExecutionToken,
  TokenVerificationResult,
  RiskAssessment,
  ExecutionConstraints,
  SlaRequirements,
} from './types';
import { DeterministicChannelRouter } from './channel-router';
import { ExecutionTokenService } from './execution-token.service';
import { PolicyGuard } from './policy-guard';
import { ExecutionCommand } from '@neuronx/playbook-engine';
import { DecisionResult, ActorType } from '@neuronx/decision-engine';
import { ChannelRoutingPolicyResolver } from './policy/channel-routing-policy.resolver';

/**
 * Main execution authority service
 */
export class NeuronXExecutionAuthority implements ExecutionAuthority {
  private channelRouter: DeterministicChannelRouter;
  private tokenService: ExecutionTokenService;
  private policyGuard: PolicyGuard;

  constructor(
    tokenRepository: any, // Will be injected
    private readonly channelRoutingPolicyResolver: ChannelRoutingPolicyResolver,
    tokenExpiryMinutes = 10
  ) {
    this.channelRouter = new DeterministicChannelRouter(
      channelRoutingPolicyResolver
    );
    this.tokenService = new ExecutionTokenService(
      tokenRepository,
      tokenExpiryMinutes
    );
    this.policyGuard = new RiskBasedPolicyGuard();
  }

  /**
   * Plan execution for a command (main entry point)
   */
  async planExecution(context: ExecutionContext): Promise<ExecutionPlan> {
    const { executionCommand, decisionResult, correlationId } = context;

    // 1. Check policy compliance
    const policyCheck = await this.policyGuard.checkPolicy(context);
    if (!policyCheck.allowed) {
      return this.createRejectedPlan(context, policyCheck.reason);
    }

    // 2. Route to appropriate channel
    const channelRouting = await this.channelRouter.routeChannel(context);

    // 3. Build execution plan
    const plan = await this.buildExecutionPlan(
      context,
      channelRouting,
      policyCheck.riskAssessment
    );

    // 4. Add token if required
    const tokenData = this.tokenService.createTokenData(
      plan,
      context.tenantId,
      context.opportunityId,
      correlationId
    );

    if (tokenData) {
      plan.token = tokenData;
    }

    return plan;
  }

  /**
   * Issue execution token
   */
  async issueToken(
    plan: ExecutionPlan,
    issuedBy: string
  ): Promise<ExecutionToken> {
    return this.tokenService.issueToken(plan, issuedBy);
  }

  /**
   * Verify execution token
   */
  async verifyToken(
    tokenId: string,
    requiredScope: {
      channel: any;
      commandType: ExecutionCommand['commandType'];
    }
  ): Promise<TokenVerificationResult> {
    return this.tokenService.verifyToken(tokenId, requiredScope);
  }

  /**
   * Mark token as used
   */
  async markTokenUsed(tokenId: string, usedBy: string): Promise<void> {
    return this.tokenService.markTokenUsed(tokenId, usedBy);
  }

  /**
   * Revoke execution token
   */
  async revokeToken(
    tokenId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    return this.tokenService.revokeToken(tokenId, revokedBy, reason);
  }

  /**
   * Build execution plan from context and routing
   */
  private async buildExecutionPlan(
    context: ExecutionContext,
    channelRouting: { channel: any; reason: string; confidence: number },
    riskAssessment: RiskAssessment
  ): Promise<ExecutionPlan> {
    const { executionCommand, decisionResult, correlationId } = context;

    // Build adapter command based on channel
    const adapterCommand = this.buildAdapterCommand(
      context,
      channelRouting.channel
    );

    // Determine execution constraints
    const constraints = this.buildExecutionConstraints(context, riskAssessment);

    // SLA requirements
    const slaRequirements = this.buildSlaRequirements(context);

    return {
      allowed: true,
      reason: `Execution approved: ${channelRouting.reason}`,
      actor: decisionResult.actor,
      mode: decisionResult.mode,
      channel: channelRouting.channel,
      adapterCommand,
      constraints,
      correlationId,
      auditReason: `Channel ${channelRouting.channel} selected with ${Math.round(channelRouting.confidence * 100)}% confidence`,
      riskAssessment,
      slaRequirements,
    };
  }

  /**
   * Build adapter command for specific channel
   */
  private buildAdapterCommand(context: ExecutionContext, channel: any) {
    const { executionCommand, decisionResult } = context;

    // Base command structure
    const adapterCommand = {
      commandId: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      commandType: executionCommand.commandType,
      channelData: {} as any,
      timeoutSeconds: 30,
      idempotencyKey: `${context.correlationId}_${executionCommand.commandId}`,
    };

    // Channel-specific data
    switch (channel) {
      case 'voice':
        adapterCommand.channelData = {
          toPhone: executionCommand.contactData?.phone || '',
          scriptId: executionCommand.scriptId,
          voiceMode: decisionResult.voiceMode || 'SCRIPTED',
          recordingEnabled: true,
          maxDurationSeconds: 300,
        };
        break;

      case 'sms':
        adapterCommand.channelData = {
          toPhone: executionCommand.contactData?.phone || '',
          message: executionCommand.messageData?.body || '',
          templateId: executionCommand.messageData?.templateId,
          priority: executionCommand.priority || 'normal',
        };
        break;

      case 'email':
        adapterCommand.channelData = {
          toEmail: executionCommand.contactData?.email || '',
          subject: executionCommand.messageData?.subject || '',
          body: executionCommand.messageData?.body || '',
          templateId: executionCommand.messageData?.templateId,
          priority: executionCommand.priority || 'normal',
        };
        break;

      case 'calendar':
        adapterCommand.channelData = {
          title: executionCommand.meetingData?.title || 'Sales Meeting',
          description: executionCommand.meetingData?.title || '',
          startTime: new Date(), // Would be calculated properly
          endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
          attendees: [executionCommand.contactData?.email || ''],
          meetingType: 'discovery',
        };
        break;
    }

    return adapterCommand;
  }

  /**
   * Build execution constraints
   */
  private buildExecutionConstraints(
    context: ExecutionContext,
    risk: RiskAssessment
  ): ExecutionConstraints {
    const constraints: ExecutionConstraints = {
      maxDurationSeconds: 300, // 5 minutes default
      complianceRequirements: [],
    };

    // Risk-based constraints
    if (risk.level === 'high' || risk.level === 'critical') {
      constraints.maxCost = 50; // Higher cost limit for high-risk
      constraints.complianceRequirements.push('human_approval_required');
    }

    // SLA-based constraints
    if (context.slaUrgency === 'urgent') {
      constraints.allowedHours = {
        start: '08:00',
        end: '20:00',
        timezone: 'UTC',
      };
    }

    return constraints;
  }

  /**
   * Build SLA requirements
   */
  private buildSlaRequirements(context: ExecutionContext): SlaRequirements {
    const urgency = context.slaUrgency;
    let targetResponseTimeMinutes: number;
    let escalationRequired: boolean;
    let escalationTimeMinutes: number | undefined;

    switch (urgency) {
      case 'urgent':
        targetResponseTimeMinutes = 15;
        escalationRequired = true;
        escalationTimeMinutes = 30;
        break;
      case 'high':
        targetResponseTimeMinutes = 60;
        escalationRequired = true;
        escalationTimeMinutes = 120;
        break;
      case 'normal':
        targetResponseTimeMinutes = 240; // 4 hours
        escalationRequired = false;
        break;
      default:
        targetResponseTimeMinutes = 480; // 8 hours
        escalationRequired = false;
    }

    return {
      urgency,
      targetResponseTimeMinutes,
      escalationRequired,
      escalationTimeMinutes,
    };
  }

  /**
   * Create rejected execution plan
   */
  private createRejectedPlan(
    context: ExecutionContext,
    reason: string
  ): ExecutionPlan {
    return {
      allowed: false,
      reason,
      actor: ActorType.AI, // Default
      mode: 'AUTONOMOUS', // Default
      channel: 'email', // Safe default
      adapterCommand: {
        commandId: `rejected_${Date.now()}`,
        commandType: context.executionCommand.commandType,
        channelData: {},
      },
      constraints: {},
      correlationId: context.correlationId,
      auditReason: `Execution rejected: ${reason}`,
      riskAssessment: {
        level: 'critical',
        score: 100,
        factors: [
          {
            factor: 'policy_violation',
            impact: 100,
            probability: 100,
            description: reason,
          },
        ],
        mitigationStrategies: [
          'Review execution policy',
          'Contact administrator',
        ],
      },
    };
  }
}

/**
 * Risk-based policy guard implementation
 */
class RiskBasedPolicyGuard implements PolicyGuard {
  async checkPolicy(context: ExecutionContext): Promise<{
    allowed: boolean;
    reason: string;
    riskAssessment: RiskAssessment;
  }> {
    const { decisionResult, riskScore, dealValue, slaUrgency, retryCount } =
      context;

    // Build risk assessment
    const riskAssessment = this.assessRisk(context);

    // Policy rules
    let allowed = true;
    let reason = 'Execution approved';

    // High-risk AI actions require approval
    if (
      decisionResult.actor === ActorType.AI &&
      riskAssessment.level === 'high'
    ) {
      if (decisionResult.mode !== 'APPROVAL_REQUIRED') {
        allowed = false;
        reason = 'High-risk AI actions require approval mode';
      }
    }

    // Critical risk blocks AI entirely
    if (
      decisionResult.actor === ActorType.AI &&
      riskAssessment.level === 'critical'
    ) {
      allowed = false;
      reason = 'Critical risk blocks AI execution';
    }

    // Too many retries require human intervention
    if (retryCount > 3) {
      if (decisionResult.actor === ActorType.AI) {
        allowed = false;
        reason = 'Excessive retries require human intervention';
      }
    }

    // Urgent SLA with AI needs approval
    if (slaUrgency === 'urgent' && decisionResult.actor === ActorType.AI) {
      if (decisionResult.mode !== 'APPROVAL_REQUIRED') {
        allowed = false;
        reason = 'Urgent SLA with AI requires approval';
      }
    }

    return { allowed, reason, riskAssessment };
  }

  private assessRisk(context: ExecutionContext): RiskAssessment {
    const { riskScore, dealValue, slaUrgency, retryCount, currentStage } =
      context;

    const factors: any[] = [];
    let totalRiskScore = riskScore;

    // Deal value risk
    if (dealValue > 100000) {
      factors.push({
        factor: 'high_deal_value',
        impact: 30,
        probability: 100,
        description: `High-value deal: $${dealValue.toLocaleString()}`,
      });
      totalRiskScore += 30;
    }

    // SLA urgency risk
    if (slaUrgency === 'urgent') {
      factors.push({
        factor: 'urgent_sla',
        impact: 25,
        probability: 100,
        description: 'Urgent SLA requirements',
      });
      totalRiskScore += 25;
    }

    // Retry risk
    if (retryCount > 0) {
      factors.push({
        factor: 'retry_attempts',
        impact: Math.min(retryCount * 10, 40),
        probability: 100,
        description: `${retryCount} previous attempts`,
      });
      totalRiskScore += Math.min(retryCount * 10, 40);
    }

    // Stage risk (early stages are riskier)
    const earlyStages = ['PROSPECT_IDENTIFIED', 'INITIAL_CONTACT'];
    if (earlyStages.includes(currentStage as any)) {
      factors.push({
        factor: 'early_stage',
        impact: 15,
        probability: 100,
        description: 'Early-stage opportunity',
      });
      totalRiskScore += 15;
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (totalRiskScore >= 80) level = 'critical';
    else if (totalRiskScore >= 60) level = 'high';
    else if (totalRiskScore >= 40) level = 'medium';
    else level = 'low';

    return {
      level,
      score: Math.min(totalRiskScore, 100),
      factors,
      mitigationStrategies: this.getMitigationStrategies(level),
    };
  }

  private getMitigationStrategies(level: string): string[] {
    const strategies = ['Standard execution monitoring'];

    if (level === 'medium' || level === 'high') {
      strategies.push('Human approval required');
    }

    if (level === 'high' || level === 'critical') {
      strategies.push('Escalation to senior team member');
      strategies.push('Additional compliance checks');
    }

    if (level === 'critical') {
      strategies.push('Executive approval required');
      strategies.push('Legal review recommended');
    }

    return strategies;
  }
}
