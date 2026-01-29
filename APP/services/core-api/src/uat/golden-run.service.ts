/**
 * Golden Run Service - WI-066B: UAT Harness Hardening
 *
 * Core API service that orchestrates the complete golden run workflow:
 * EXPLAIN → PLAN → APPROVE → EXECUTE
 *
 * Ensures all operations go through proper NeuronX authority channels.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { getUatConfig } from '@neuronx/uat-harness';
import { UatExecutionMode } from '@neuronx/uat-harness';

interface GoldenRunContext {
  tenantId: string;
  correlationId: string;
  runId: string;
  startTime: Date;
}

interface GoldenRunPhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

interface GoldenRunResult {
  success: boolean;
  runId: string;
  correlationId: string;
  duration: number;
  phases: Record<string, GoldenRunPhase>;
  selectedOpportunity?: any;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class GoldenRunService {
  private readonly logger = new Logger(GoldenRunService.name);
  private readonly prisma = new PrismaClient();

  constructor(private readonly auditService: AuditService) {}

  /**
   * Execute complete golden run workflow
   */
  async executeGoldenRun(
    tenantId: string,
    correlationId: string
  ): Promise<GoldenRunResult> {
    const runId = `golden_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: GoldenRunContext = {
      tenantId,
      correlationId,
      runId,
      startTime: new Date(),
    };

    const result: GoldenRunResult = {
      success: false,
      runId,
      correlationId,
      duration: 0,
      phases: {},
      errors: [],
      warnings: [],
    };

    this.logger.log(`Starting golden run ${runId} for tenant ${tenantId}`);

    try {
      // Phase 1: Environment validation
      await this.executePhase('environment', context, result, () =>
        this.validateEnvironment(context)
      );

      // Phase 2: Get work queue opportunity
      await this.executePhase('workQueue', context, result, () =>
        this.getWorkQueueOpportunity(context)
      );

      // Phase 3: Explain decision
      await this.executePhase('explain', context, result, () =>
        this.explainDecision(context, result)
      );

      // Phase 4: Plan execution
      await this.executePhase('plan', context, result, () =>
        this.planExecution(context, result)
      );

      // Phase 5: Approve execution
      await this.executePhase('approve', context, result, () =>
        this.approveExecution(context, result)
      );

      // Phase 6: Execute commands
      await this.executePhase('execute', context, result, () =>
        this.executeCommands(context, result)
      );

      // Phase 7: Verify audit trail
      await this.executePhase('audit', context, result, () =>
        this.verifyAuditTrail(context, result)
      );

      result.success = this.checkOverallSuccess(result);
      result.duration = Date.now() - context.startTime.getTime();

      await this.auditService.logEvent(
        result.success ? 'uat_golden_run_completed' : 'uat_golden_run_failed',
        {
          runId,
          tenantId,
          correlationId,
          duration: result.duration,
          phases: Object.keys(result.phases),
          selectedOpportunityId: result.selectedOpportunity?.id,
          isDryRun: true,
        },
        'uat-system',
        tenantId
      );

      this.logger.log(
        `Golden run ${runId} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`
      );
    } catch (error) {
      result.errors.push(
        `Golden run failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      result.duration = Date.now() - context.startTime.getTime();

      await this.auditService.logEvent(
        'uat_golden_run_error',
        {
          runId,
          tenantId,
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: result.duration,
          isDryRun: true,
        },
        'uat-system',
        tenantId
      );
    }

    return result;
  }

  /**
   * Execute a phase with proper error handling and timing
   */
  private async executePhase(
    phaseName: string,
    context: GoldenRunContext,
    result: GoldenRunResult,
    phaseFn: () => Promise<any>
  ): Promise<void> {
    const phase: GoldenRunPhase = {
      name: phaseName,
      status: 'running',
      startTime: new Date(),
    };

    result.phases[phaseName] = phase;

    try {
      phase.result = await phaseFn();
      phase.status = 'completed';
      phase.endTime = new Date();

      await this.auditService.logEvent(
        `uat_golden_run_phase_${phaseName}`,
        {
          runId: context.runId,
          tenantId: context.tenantId,
          correlationId: context.correlationId,
          phase: phaseName,
          status: 'completed',
          duration: phase.endTime.getTime() - phase.startTime!.getTime(),
          result: phase.result,
          isDryRun: true,
        },
        'uat-system',
        context.tenantId
      );
    } catch (error) {
      phase.status = 'failed';
      phase.endTime = new Date();
      phase.error = error instanceof Error ? error.message : 'Unknown error';

      result.errors.push(`${phaseName} phase failed: ${phase.error}`);

      await this.auditService.logEvent(
        `uat_golden_run_phase_${phaseName}_failed`,
        {
          runId: context.runId,
          tenantId: context.tenantId,
          correlationId: context.correlationId,
          phase: phaseName,
          status: 'failed',
          error: phase.error,
          duration: phase.endTime.getTime() - phase.startTime!.getTime(),
          isDryRun: true,
        },
        'uat-system',
        context.tenantId
      );

      throw error;
    }
  }

  /**
   * Phase 1: Validate UAT environment
   */
  private async validateEnvironment(context: GoldenRunContext): Promise<any> {
    const uatConfig = getUatConfig();

    if (uatConfig.neuronxEnv !== 'uat') {
      throw new Error(
        `Golden run only allowed in UAT environment (current: ${uatConfig.neuronxEnv})`
      );
    }

    if (!uatConfig.uatTenantIds.includes(context.tenantId)) {
      throw new Error(`Tenant ${context.tenantId} not in UAT allowlist`);
    }

    if (!uatConfig.uatKillSwitch) {
      throw new Error(
        'LIVE_UAT execution requires kill switch to be enabled for safety'
      );
    }

    return {
      environment: uatConfig.neuronxEnv,
      tenantAllowed: true,
      killSwitchActive: uatConfig.uatKillSwitch,
      mode: uatConfig.uatMode,
    };
  }

  /**
   * Phase 2: Get work queue opportunity
   */
  private async getWorkQueueOpportunity(
    context: GoldenRunContext
  ): Promise<any> {
    // Get opportunities from database (simulating work queue)
    const opportunities = await this.prisma.opportunity.findMany({
      where: {
        tenantId: context.tenantId,
        state: { in: ['NEW', 'CONTACT_ATTEMPTING', 'QUALIFIED'] },
      },
      include: {
        contact: true,
        team: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (opportunities.length === 0) {
      throw new Error('No opportunities found in work queue');
    }

    // Select first opportunity for golden run
    const selectedOpportunity = opportunities[0];

    return {
      opportunityCount: opportunities.length,
      selectedOpportunity: {
        id: selectedOpportunity.id,
        title: selectedOpportunity.title,
        state: selectedOpportunity.state,
        value: selectedOpportunity.value,
        contactName: selectedOpportunity.contact?.name,
        teamName: selectedOpportunity.team?.name,
      },
    };
  }

  /**
   * Phase 3: Explain decision (simplified for UAT)
   */
  private async explainDecision(
    context: GoldenRunContext,
    result: GoldenRunResult
  ): Promise<any> {
    const selectedOpp = result.phases.workQueue?.result?.selectedOpportunity;
    if (!selectedOpp) {
      throw new Error('No opportunity selected for decision explanation');
    }

    // Get opportunity with full context
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: selectedOpp.id },
      include: {
        contact: true,
        team: true,
      },
    });

    if (!opportunity) {
      throw new Error(`Opportunity ${selectedOpp.id} not found`);
    }

    // Simplified decision explanation for UAT
    const decision =
      opportunity.state === 'QUALIFIED' ? 'qualified' : 'needs_review';
    const confidence = opportunity.state === 'QUALIFIED' ? 0.85 : 0.65;

    return {
      decision: {
        type: 'qualification_decision',
        outcome: decision,
        reason: `Based on opportunity state: ${opportunity.state}`,
      },
      confidence,
      reasoning: `Opportunity in ${opportunity.state} state with value $${opportunity.value}`,
      factors: {
        state: opportunity.state,
        value: opportunity.value,
        contactExists: !!opportunity.contact,
        teamAssigned: !!opportunity.team,
      },
    };
  }

  /**
   * Phase 4: Plan execution (simplified for UAT)
   */
  private async planExecution(
    context: GoldenRunContext,
    result: GoldenRunResult
  ): Promise<any> {
    const selectedOpp = result.phases.workQueue?.result?.selectedOpportunity;
    const decision = result.phases.explain?.result?.decision;

    if (!selectedOpp || !decision) {
      throw new Error(
        'Opportunity and decision required for execution planning'
      );
    }

    // Simplified execution planning for UAT
    const commands = [];

    if (decision.outcome === 'qualified') {
      commands.push({
        actionType: 'SEND_EMAIL',
        commandId: `email_${selectedOpp.id}_${Date.now()}`,
      });
      commands.push({
        actionType: 'MAKE_CALL',
        commandId: `call_${selectedOpp.id}_${Date.now()}`,
      });
    } else {
      commands.push({
        actionType: 'SEND_EMAIL',
        commandId: `followup_${selectedOpp.id}_${Date.now()}`,
      });
    }

    return {
      planId: `plan_${selectedOpp.id}_${Date.now()}`,
      commandCount: commands.length,
      actions: commands.map(cmd => cmd.actionType),
      commands,
    };
  }

  /**
   * Phase 5: Approve execution
   */
  private async approveExecution(
    context: GoldenRunContext,
    result: GoldenRunResult
  ): Promise<any> {
    const plan = result.phases.plan?.result;

    if (!plan) {
      throw new Error('Execution plan required for approval');
    }

    // Simulate L4 approval for UAT (normally would require human approval)
    const approvalId = `uat_approval_${Date.now()}`;

    return {
      approvalId,
      approvedBy: 'uat-system',
      approvalLevel: 'L4-automated',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Phase 6: Execute commands (simplified DRY_RUN simulation)
   */
  private async executeCommands(
    context: GoldenRunContext,
    result: GoldenRunResult
  ): Promise<any> {
    const plan = result.phases.plan?.result;

    if (!plan) {
      throw new Error('Execution plan required for command execution');
    }

    const executionResults = [];
    let successCount = 0;

    // Simulate command execution for UAT
    for (const command of plan.commands) {
      // Simulate successful execution with deterministic external ID
      const externalId = `uat_dry_run_${command.commandId}_${command.actionType.toLowerCase()}`;

      executionResults.push({
        commandId: command.commandId,
        success: true,
        externalId,
        simulated: true,
      });

      successCount++;

      // Audit each command execution
      await this.auditService.logEvent(
        'uat_command_executed',
        {
          commandId: command.commandId,
          actionType: command.actionType,
          externalId,
          simulated: true,
          uatMode: 'dry_run',
        },
        'uat-system',
        context.tenantId
      );
    }

    return {
      results: executionResults,
      successCount,
      totalCount: executionResults.length,
    };
  }

  /**
   * Phase 7: Verify audit trail completeness
   */
  private async verifyAuditTrail(
    context: GoldenRunContext,
    result: GoldenRunResult
  ): Promise<any> {
    // Check that audit events were created for this correlation ID
    const auditEvents = await this.prisma.auditLog.findMany({
      where: {
        tenantId: context.tenantId,
        metadata: {
          path: ['correlationId'],
          equals: context.correlationId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const uatEvents = auditEvents.filter(
      event =>
        event.action.startsWith('uat_') || event.metadata?.uatMode === 'dry_run'
    );

    return {
      eventCount: uatEvents.length,
      events: uatEvents.map(event => ({
        action: event.action,
        timestamp: event.createdAt,
        resourceId: event.resourceId,
      })),
      correlationId: context.correlationId,
    };
  }

  /**
   * Check overall success based on phase results
   */
  private checkOverallSuccess(result: GoldenRunResult): boolean {
    const requiredPhases = [
      'environment',
      'workQueue',
      'explain',
      'plan',
      'approve',
      'execute',
    ];
    const criticalPhases = ['environment', 'execute'];

    // All required phases must complete
    for (const phase of requiredPhases) {
      if (result.phases[phase]?.status !== 'completed') {
        return false;
      }
    }

    // Critical phases must succeed
    for (const phase of criticalPhases) {
      if (result.phases[phase]?.error) {
        return false;
      }
    }

    // Execution phase must have some successes
    const executeResult = result.phases.execute?.result;
    if (!executeResult || executeResult.successCount === 0) {
      return false;
    }

    return result.errors.length === 0;
  }
}
