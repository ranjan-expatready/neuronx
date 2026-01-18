import { v4 as uuidv4 } from 'uuid';
import type { GhlBoundaryPolicy } from './boundary-policy.schema';
import { BoundaryPolicyResolver } from './boundary-policy.resolver';
import {
  ViolationType,
  ViolationSeverity,
  EntityType,
} from './ghl-violation.types';
import type {
  GhlViolation,
  BoundaryAnalysisResult,
} from './ghl-violation.types';

/**
 * Analyzes GHL snapshots for boundary violations
 * Returns deterministic results - same snapshot = same violations
 */
export class GhlBoundaryAnalyzer {
  private readonly policyResolver: BoundaryPolicyResolver;

  constructor(
    private readonly policy: GhlBoundaryPolicy,
    private readonly policyVersion: string
  ) {
    this.policyResolver = new BoundaryPolicyResolver(policy);
  }

  /**
   * Analyze a complete GHL snapshot for boundary violations
   * Returns deterministic results based on snapshot content and policy
   */
  analyzeSnapshot(
    tenantId: string,
    snapshotId: string,
    snapshotData: any,
    correlationId: string
  ): BoundaryAnalysisResult {
    const startTime = Date.now();
    const violations: GhlViolation[] = [];

    try {
      // Analyze different entity types in the snapshot
      violations.push(
        ...this.analyzeWorkflows(
          snapshotData.workflows || [],
          tenantId,
          snapshotId,
          correlationId
        )
      );
      violations.push(
        ...this.analyzePipelines(
          snapshotData.pipelines || [],
          tenantId,
          snapshotId,
          correlationId
        )
      );
      violations.push(
        ...this.analyzeAiWorkers(
          snapshotData.aiWorkers || [],
          tenantId,
          snapshotId,
          correlationId
        )
      );
      violations.push(
        ...this.analyzeWebhooks(
          snapshotData.webhooks || [],
          tenantId,
          snapshotId,
          correlationId
        )
      );
      violations.push(
        ...this.analyzeCalendars(
          snapshotData.calendars || [],
          tenantId,
          snapshotId,
          correlationId
        )
      );

      // Analyze any unknown entities as UNKNOWN_RISK
      violations.push(
        ...this.analyzeUnknownEntities(
          snapshotData,
          tenantId,
          snapshotId,
          correlationId
        )
      );
    } catch (error) {
      // Log error but don't fail analysis - treat as UNKNOWN_RISK
      console.error(
        `Boundary analysis error for snapshot ${snapshotId}:`,
        error
      );
      violations.push(
        this.createUnknownRiskViolation(
          tenantId,
          snapshotId,
          correlationId,
          'snapshot',
          snapshotId,
          'root',
          { error: error.message, analysisFailed: true }
        )
      );
    }

    const analysisDuration = Date.now() - startTime;
    const entityCount = this.countEntities(snapshotData);

    return {
      tenantId,
      snapshotId,
      correlationId,
      policyVersion: this.policyVersion,
      violations,
      analyzedAt: new Date(),
      analysisDuration,
      entityCount,
      summary: this.createSummary(violations),
    };
  }

  private analyzeWorkflows(
    workflows: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    workflows.forEach((workflow, index) => {
      const workflowId = workflow.id || `workflow-${index}`;
      const workflowPath = `workflows.${index}`;

      // Check for logic in workflow conditions
      violations.push(
        ...this.analyzeWorkflowConditions(
          workflow.conditions || [],
          tenantId,
          snapshotId,
          correlationId,
          workflowId,
          `${workflowPath}.conditions`
        )
      );

      // Check workflow actions
      violations.push(
        ...this.analyzeWorkflowActions(
          workflow.actions || [],
          tenantId,
          snapshotId,
          correlationId,
          workflowId,
          `${workflowPath}.actions`
        )
      );

      // Check complexity thresholds
      const complexityViolation = this.analyzeWorkflowComplexity(
        workflow,
        tenantId,
        snapshotId,
        correlationId,
        workflowId,
        workflowPath
      );
      if (complexityViolation) {
        violations.push(complexityViolation);
      }
    });

    return violations;
  }

  private analyzeWorkflowConditions(
    conditions: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string,
    workflowId: string,
    basePath: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    conditions.forEach((condition, index) => {
      const conditionPath = `${basePath}.${index}`;

      // Check for business logic patterns in condition expressions
      const logicCheck = this.policyResolver.matchesBusinessLogicPattern(
        JSON.stringify(condition)
      );

      if (logicCheck.matched) {
        violations.push({
          id: uuidv4(),
          tenantId,
          snapshotId,
          violationId: `logic-${workflowId}-${conditionPath.replace(/\./g, '-')}`,
          violationType: ViolationType.LOGIC_IN_WORKFLOW,
          severity: ViolationSeverity.HIGH,
          entityType: EntityType.WORKFLOW,
          entityId: workflowId,
          path: conditionPath,
          evidence: {
            offendingNode: condition,
            matchedPatterns: logicCheck.patterns,
            context: { workflowId },
          },
          policyVersion: this.policyVersion,
          correlationId,
          createdAt: new Date(),
          detectedAt: new Date(),
        });
      }
    });

    return violations;
  }

  private analyzeWorkflowActions(
    actions: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string,
    workflowId: string,
    basePath: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    actions.forEach((action, index) => {
      const actionPath = `${basePath}.${index}`;
      const actionType = action.type || action.action || 'unknown';

      // Check if action is explicitly denied
      if (this.policyResolver.isWorkflowActionDenied(actionType)) {
        violations.push({
          id: uuidv4(),
          tenantId,
          snapshotId,
          violationId: `denied-action-${workflowId}-${actionPath.replace(/\./g, '-')}`,
          violationType: ViolationType.UNAPPROVED_AUTOMATION_ACTION,
          severity: ViolationSeverity.CRITICAL,
          entityType: EntityType.WORKFLOW,
          entityId: workflowId,
          path: actionPath,
          evidence: {
            offendingNode: action,
            context: { actionType, workflowId },
          },
          policyVersion: this.policyVersion,
          correlationId,
          createdAt: new Date(),
          detectedAt: new Date(),
        });
      }
      // Check if unknown action (not explicitly allowed)
      else if (!this.policyResolver.isWorkflowActionAllowed(actionType)) {
        violations.push(
          this.createUnknownRiskViolation(
            tenantId,
            snapshotId,
            correlationId,
            EntityType.WORKFLOW,
            workflowId,
            actionPath,
            { actionType, action }
          )
        );
      }
    });

    return violations;
  }

  private analyzeWorkflowComplexity(
    workflow: any,
    tenantId: string,
    snapshotId: string,
    correlationId: string,
    workflowId: string,
    workflowPath: string
  ): GhlViolation | null {
    const metrics = {
      actionCount: workflow.actions?.length || 0,
      conditionDepth: this.calculateMaxConditionDepth(
        workflow.conditions || []
      ),
      branchCount: this.calculateBranchCount(workflow),
      triggerCount: workflow.triggers?.length || 0,
    };

    const thresholdCheck =
      this.policyResolver.checkComplexityThresholds(metrics);

    if (thresholdCheck.exceeded) {
      return {
        id: uuidv4(),
        tenantId,
        snapshotId,
        violationId: `complexity-${workflowId}`,
        violationType: ViolationType.LOGIC_IN_WORKFLOW,
        severity: ViolationSeverity.MEDIUM,
        entityType: EntityType.WORKFLOW,
        entityId: workflowId,
        path: workflowPath,
        evidence: {
          offendingNode: metrics,
          context: {
            violations: thresholdCheck.violations,
            workflowId,
          },
        },
        policyVersion: this.policyVersion,
        correlationId,
        createdAt: new Date(),
        detectedAt: new Date(),
      };
    }

    return null;
  }

  private analyzePipelines(
    pipelines: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    pipelines.forEach((pipeline, index) => {
      const pipelineId = pipeline.id || `pipeline-${index}`;
      const pipelinePath = `pipelines.${index}`;

      // Check for unapproved stage transitions
      violations.push(
        ...this.analyzePipelineStages(
          pipeline.stages || [],
          tenantId,
          snapshotId,
          correlationId,
          pipelineId,
          `${pipelinePath}.stages`
        )
      );
    });

    return violations;
  }

  private analyzePipelineStages(
    stages: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string,
    pipelineId: string,
    basePath: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    stages.forEach((stage, index) => {
      const stagePath = `${basePath}.${index}`;
      const stageName = stage.name || `stage-${index}`;

      // Check if stage transition is allowed
      if (!this.policyResolver.isPipelineMutationAllowed('move_to_stage')) {
        // This would be a policy configuration issue, but we check it anyway
        violations.push({
          id: uuidv4(),
          tenantId,
          snapshotId,
          violationId: `stage-transition-${pipelineId}-${stageName}`,
          violationType: ViolationType.UNAPPROVED_STAGE_TRANSITION,
          severity: ViolationSeverity.HIGH,
          entityType: EntityType.PIPELINE,
          entityId: pipelineId,
          path: stagePath,
          evidence: {
            offendingNode: stage,
            context: { stageName, pipelineId },
          },
          policyVersion: this.policyVersion,
          correlationId,
          createdAt: new Date(),
          detectedAt: new Date(),
        });
      }
    });

    return violations;
  }

  private analyzeAiWorkers(
    aiWorkers: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    aiWorkers.forEach((worker, index) => {
      const workerId = worker.id || `ai-worker-${index}`;
      const workerPath = `aiWorkers.${index}`;

      // Check AI worker capabilities
      const capabilities = worker.capabilities || [];
      capabilities.forEach((capability: string, capIndex: number) => {
        if (this.policyResolver.isAiWorkerCapabilityDenied(capability)) {
          violations.push({
            id: uuidv4(),
            tenantId,
            snapshotId,
            violationId: `ai-capability-${workerId}-${capability}`,
            violationType: ViolationType.AI_WORKER_UNSCOPED_ACTIONS,
            severity: ViolationSeverity.HIGH,
            entityType: EntityType.AI_WORKER,
            entityId: workerId,
            path: `${workerPath}.capabilities.${capIndex}`,
            evidence: {
              offendingNode: capability,
              context: { workerId, capability },
            },
            policyVersion: this.policyVersion,
            correlationId,
            createdAt: new Date(),
            detectedAt: new Date(),
          });
        }
      });
    });

    return violations;
  }

  private analyzeWebhooks(
    webhooks: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];

    if (!this.policyResolver.requiresNeuronxTokenHeader()) {
      return violations; // No webhook security requirements
    }

    webhooks.forEach((webhook, index) => {
      const webhookId = webhook.id || `webhook-${index}`;
      const webhookPath = `webhooks.${index}`;

      // Check if webhook calls include required NeuronX token header
      const headers = webhook.headers || {};
      const hasNeuronxToken = Object.keys(headers).some(
        header =>
          header.toLowerCase().includes('neuronx') ||
          header.toLowerCase().includes('token')
      );

      if (!hasNeuronxToken) {
        violations.push({
          id: uuidv4(),
          tenantId,
          snapshotId,
          violationId: `webhook-security-${webhookId}`,
          violationType: ViolationType.WEBHOOK_BYPASS_RISK,
          severity: ViolationSeverity.CRITICAL,
          entityType: EntityType.WEBHOOK,
          entityId: webhookId,
          path: `${webhookPath}.headers`,
          evidence: {
            offendingNode: headers,
            context: {
              webhookId,
              url: webhook.url,
              requiresToken: true,
            },
          },
          policyVersion: this.policyVersion,
          correlationId,
          createdAt: new Date(),
          detectedAt: new Date(),
        });
      }
    });

    return violations;
  }

  private analyzeCalendars(
    calendars: any[],
    tenantId: string,
    snapshotId: string,
    correlationId: string
  ): GhlViolation[] {
    // Calendar analysis would go here - for now, just check for unknown entities
    return this.analyzeUnknownEntities(
      { calendars },
      tenantId,
      snapshotId,
      correlationId
    );
  }

  private analyzeUnknownEntities(
    snapshotData: any,
    tenantId: string,
    snapshotId: string,
    correlationId: string
  ): GhlViolation[] {
    const violations: GhlViolation[] = [];
    const knownEntityTypes = [
      'workflows',
      'pipelines',
      'aiWorkers',
      'webhooks',
      'calendars',
    ];

    // Find unknown top-level properties in snapshot
    Object.keys(snapshotData).forEach(key => {
      if (!knownEntityTypes.includes(key) && Array.isArray(snapshotData[key])) {
        const entities = snapshotData[key];
        entities.forEach((entity: any, index: number) => {
          violations.push(
            this.createUnknownRiskViolation(
              tenantId,
              snapshotId,
              correlationId,
              'unknown',
              `${key}-${index}`,
              `${key}.${index}`,
              { entityType: key, entity }
            )
          );
        });
      }
    });

    return violations;
  }

  private createUnknownRiskViolation(
    tenantId: string,
    snapshotId: string,
    correlationId: string,
    entityType: string,
    entityId: string,
    path: string,
    context: any
  ): GhlViolation {
    const riskRule =
      this.policyResolver.getRiskClassificationRule('unknownActionType');

    return {
      id: uuidv4(),
      tenantId,
      snapshotId,
      violationId: `unknown-${entityType}-${entityId}-${Date.now()}`,
      violationType: ViolationType.UNKNOWN_RISK,
      severity: riskRule?.severity || ViolationSeverity.LOW,
      entityType: entityType as EntityType,
      entityId,
      path,
      evidence: {
        offendingNode: context,
        context: { classification: 'unknown_entity_type' },
      },
      policyVersion: this.policyVersion,
      correlationId,
      createdAt: new Date(),
      detectedAt: new Date(),
    };
  }

  private calculateMaxConditionDepth(conditions: any[]): number {
    // Simplified depth calculation - in real implementation this would traverse condition trees
    return Math.max(0, ...conditions.map(c => this.getConditionDepth(c)));
  }

  private getConditionDepth(condition: any): number {
    if (!condition || typeof condition !== 'object') return 0;

    let maxDepth = 1;
    if (condition.and) {
      maxDepth = Math.max(
        maxDepth,
        ...condition.and.map((c: any) => this.getConditionDepth(c) + 1)
      );
    }
    if (condition.or) {
      maxDepth = Math.max(
        maxDepth,
        ...condition.or.map((c: any) => this.getConditionDepth(c) + 1)
      );
    }

    return maxDepth;
  }

  private calculateBranchCount(workflow: any): number {
    // Simplified branch counting - count conditional branches
    return (
      workflow.branches?.length || workflow.conditionalBranches?.length || 0
    );
  }

  private countEntities(snapshotData: any): number {
    let count = 0;
    Object.values(snapshotData).forEach(value => {
      if (Array.isArray(value)) {
        count += value.length;
      }
    });
    return count;
  }

  private createSummary(violations: GhlViolation[]) {
    const summary = {
      totalViolations: violations.length,
      violationsBySeverity: {} as Record<ViolationSeverity, number>,
      violationsByType: {} as Record<ViolationType, number>,
      violationsByEntityType: {} as Record<EntityType, number>,
    };

    violations.forEach(v => {
      summary.violationsBySeverity[v.severity] =
        (summary.violationsBySeverity[v.severity] || 0) + 1;
      summary.violationsByType[v.violationType] =
        (summary.violationsByType[v.violationType] || 0) + 1;
      summary.violationsByEntityType[v.entityType] =
        (summary.violationsByEntityType[v.entityType] || 0) + 1;
    });

    return summary;
  }
}
