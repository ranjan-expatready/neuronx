import { describe, it, expect } from 'vitest';
import { GhlBoundaryAnalyzer } from '../ghl-boundary-analyzer';
import {
  ViolationType,
  ViolationSeverity,
  EntityType,
} from '../ghl-violation.types';

describe('GhlBoundaryAnalyzer', () => {
  const mockPolicy = {
    enforcementMode: 'monitor_only' as const,
    businessLogicRules: [
      {
        name: 'scoring_logic',
        description: 'Lead scoring algorithms',
        patterns: ['calculate.*score', 'update.*score'],
      },
    ],
    allowedWorkflowActions: ['send_email', 'send_sms', 'update_contact'],
    deniedWorkflowActions: ['qualify_lead', 'disqualify_lead'],
    allowedPipelineMutations: ['move_to_stage', 'update_status'],
    deniedPipelineMutations: ['create_custom_stage'],
    allowedAiWorkerCapabilities: ['generate_email_content'],
    deniedAiWorkerCapabilities: ['make_decisions'],
    thresholds: {
      maxActionsPerWorkflow: 20,
      maxConditionDepth: 2,
      maxBranchCount: 5,
      maxTriggerCount: 10,
    },
    requireNeuronxTokenHeaderOnWebhookCalls: true,
    riskClassificationRules: {
      unknownActionType: {
        severity: 'LOW' as const,
        requiresReview: false,
      },
    },
    severityLevels: {
      LOW: { description: 'Minor violations', blocksTenant: false },
      MEDIUM: { description: 'Moderate violations', blocksTenant: false },
      HIGH: { description: 'Severe violations', blocksTenant: true },
      CRITICAL: { description: 'Critical violations', blocksTenant: true },
    },
    violationCategories: {
      LOGIC_IN_WORKFLOW: 'Business logic in workflow conditions',
      UNAPPROVED_AUTOMATION_ACTION: 'Actions that perform business decisions',
    },
  };

  const analyzer = new GhlBoundaryAnalyzer(mockPolicy, '1.0.0');

  describe('analyzeSnapshot', () => {
    it('should return deterministic results for same input', () => {
      const tenantId = 'tenant-123';
      const snapshotId = 'snapshot-456';
      const correlationId = 'corr-789';
      const snapshotData = {
        workflows: [
          {
            id: 'workflow-1',
            conditions: [
              { field: 'score', operator: '>', value: 80 }, // Business logic pattern
            ],
            actions: [
              { type: 'send_email', template: 'nurture' },
              { type: 'qualify_lead' }, // Denied action
            ],
          },
        ],
        pipelines: [],
        aiWorkers: [],
        webhooks: [],
        calendars: [],
      };

      // Run analysis twice
      const result1 = analyzer.analyzeSnapshot(
        tenantId,
        snapshotId,
        snapshotData,
        correlationId
      );
      const result2 = analyzer.analyzeSnapshot(
        tenantId,
        snapshotId,
        snapshotData,
        correlationId
      );

      // Results should be identical
      expect(result1.tenantId).toBe(result2.tenantId);
      expect(result1.snapshotId).toBe(result2.snapshotId);
      expect(result1.correlationId).toBe(result2.correlationId);
      expect(result1.violations.length).toBe(result2.violations.length);

      // Compare violations
      result1.violations.forEach((v1, index) => {
        const v2 = result2.violations[index];
        expect(v1.violationId).toBe(v2.violationId);
        expect(v1.violationType).toBe(v2.violationType);
        expect(v1.severity).toBe(v2.severity);
        expect(v1.entityType).toBe(v2.entityType);
        expect(v1.entityId).toBe(v2.entityId);
        expect(v1.path).toBe(v2.path);
      });
    });

    it('should detect logic in workflow conditions', () => {
      const snapshotData = {
        workflows: [
          {
            id: 'workflow-1',
            conditions: [
              { field: 'score', operator: '>', value: 80 }, // Matches scoring pattern
            ],
            actions: [{ type: 'send_email' }],
          },
        ],
        pipelines: [],
        aiWorkers: [],
        webhooks: [],
        calendars: [],
      };

      const result = analyzer.analyzeSnapshot(
        'tenant-123',
        'snapshot-456',
        snapshotData,
        'corr-789'
      );

      expect(result.violations.length).toBeGreaterThan(0);
      const violation = result.violations.find(
        v => v.violationType === ViolationType.LOGIC_IN_WORKFLOW
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe(ViolationSeverity.HIGH);
      expect(violation!.entityType).toBe(EntityType.WORKFLOW);
      expect(violation!.entityId).toBe('workflow-1');
    });

    it('should detect denied workflow actions', () => {
      const snapshotData = {
        workflows: [
          {
            id: 'workflow-1',
            conditions: [],
            actions: [
              { type: 'send_email' }, // Allowed
              { type: 'qualify_lead' }, // Denied
            ],
          },
        ],
        pipelines: [],
        aiWorkers: [],
        webhooks: [],
        calendars: [],
      };

      const result = analyzer.analyzeSnapshot(
        'tenant-123',
        'snapshot-456',
        snapshotData,
        'corr-789'
      );

      const violation = result.violations.find(
        v => v.violationType === ViolationType.UNAPPROVED_AUTOMATION_ACTION
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe(ViolationSeverity.CRITICAL);
      expect(violation!.entityId).toBe('workflow-1');
    });

    it('should detect AI worker denied capabilities', () => {
      const snapshotData = {
        workflows: [],
        pipelines: [],
        aiWorkers: [
          {
            id: 'ai-worker-1',
            capabilities: ['generate_email_content', 'make_decisions'], // Second is denied
          },
        ],
        webhooks: [],
        calendars: [],
      };

      const result = analyzer.analyzeSnapshot(
        'tenant-123',
        'snapshot-456',
        snapshotData,
        'corr-789'
      );

      const violation = result.violations.find(
        v => v.violationType === ViolationType.AI_WORKER_UNSCOPED_ACTIONS
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe(ViolationSeverity.HIGH);
      expect(violation!.entityType).toBe(EntityType.AI_WORKER);
      expect(violation!.entityId).toBe('ai-worker-1');
    });

    it('should detect webhook security violations', () => {
      const snapshotData = {
        workflows: [],
        pipelines: [],
        aiWorkers: [],
        webhooks: [
          {
            id: 'webhook-1',
            url: 'https://api.example.com/webhook',
            headers: {
              'Content-Type': 'application/json',
              // Missing NeuronX token header
            },
          },
        ],
        calendars: [],
      };

      const result = analyzer.analyzeSnapshot(
        'tenant-123',
        'snapshot-456',
        snapshotData,
        'corr-789'
      );

      const violation = result.violations.find(
        v => v.violationType === ViolationType.WEBHOOK_BYPASS_RISK
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe(ViolationSeverity.CRITICAL);
      expect(violation!.entityType).toBe(EntityType.WEBHOOK);
      expect(violation!.entityId).toBe('webhook-1');
    });

    it('should classify unknown entities as UNKNOWN_RISK', () => {
      const snapshotData = {
        workflows: [],
        pipelines: [],
        aiWorkers: [],
        webhooks: [],
        calendars: [],
        unknownEntities: [{ id: 'unknown-1', type: 'custom_action' }],
      };

      const result = analyzer.analyzeSnapshot(
        'tenant-123',
        'snapshot-456',
        snapshotData,
        'corr-789'
      );

      const violation = result.violations.find(
        v => v.violationType === ViolationType.UNKNOWN_RISK
      );
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe(ViolationSeverity.LOW); // From risk classification rule
      expect(violation!.entityType).toBe('unknown');
    });

    it('should create correct summary statistics', () => {
      const snapshotData = {
        workflows: [
          {
            id: 'workflow-1',
            conditions: [{ field: 'score', operator: '>', value: 80 }],
            actions: [{ type: 'qualify_lead' }],
          },
        ],
        pipelines: [],
        aiWorkers: [
          {
            id: 'ai-worker-1',
            capabilities: ['make_decisions'],
          },
        ],
        webhooks: [],
        calendars: [],
      };

      const result = analyzer.analyzeSnapshot(
        'tenant-123',
        'snapshot-456',
        snapshotData,
        'corr-789'
      );

      expect(result.summary.totalViolations).toBeGreaterThan(0);
      expect(typeof result.summary.violationsBySeverity).toBe('object');
      expect(typeof result.summary.violationsByType).toBe('object');
      expect(typeof result.summary.violationsByEntityType).toBe('object');
      expect(result.entityCount).toBe(2); // 1 workflow + 1 ai worker
    });
  });
});
