/**
 * Experiment Manager Tests - WI-031: Playbook Experimentation & Outcome Intelligence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExperimentManager } from '../experiment-manager';
import { ExperimentState, AssignmentStrategyType } from '../types';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

describe('ExperimentManager', () => {
  let experimentManager: ExperimentManager;

  beforeEach(() => {
    experimentManager = new ExperimentManager();
  });

  describe('createExperiment', () => {
    it('should create a new experiment in DRAFT state', () => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: {
          trafficPercentage: 100,
        },
        safetyConstraints: {
          emergencyStopEnabled: true,
        },
      };

      const experiment = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );

      expect(experiment.experimentId).toBeDefined();
      expect(experiment.name).toBe('Test Experiment');
      expect(experiment.state).toBe(ExperimentState.DRAFT);
      expect(experiment.createdBy).toBe('test-user');
      expect(experiment.variants).toHaveLength(2);
    });

    it('should validate experiment has at least 2 variants', () => {
      const invalidExperiment = {
        name: 'Invalid Experiment',
        description: 'Missing variants',
        tenantId: 'test-tenant',
        variants: [],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: {},
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      expect(() => {
        experimentManager.createExperiment(invalidExperiment, 'test-user');
      }).toThrow('Experiment must have at least 2 variants');
    });

    it('should validate experiment has a control variant', () => {
      const invalidExperiment = {
        name: 'Invalid Experiment',
        description: 'No control variant',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { 'variant-a': 100 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      expect(() => {
        experimentManager.createExperiment(invalidExperiment, 'test-user');
      }).toThrow('Experiment must have a control variant');
    });
  });

  describe('startExperiment', () => {
    it('should start a draft experiment', () => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const created = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );
      const started = experimentManager.startExperiment(
        created.experimentId,
        'test-user'
      );

      expect(started.state).toBe(ExperimentState.ACTIVE);
      expect(started.startedAt).toBeDefined();
      expect(started.updatedAt.getTime()).toBeGreaterThan(
        started.createdAt.getTime()
      );
    });

    it('should reject starting non-draft experiments', () => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const created = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );
      experimentManager.startExperiment(created.experimentId, 'test-user');

      expect(() => {
        experimentManager.startExperiment(created.experimentId, 'test-user');
      }).toThrow('is in active state, must be DRAFT to start');
    });
  });

  describe('assignOpportunity', () => {
    let activeExperiment: any;

    beforeEach(() => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const created = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );
      activeExperiment = experimentManager.startExperiment(
        created.experimentId,
        'test-user'
      );
    });

    it('should assign eligible opportunity to experiment variant', () => {
      const opportunity: any = {
        opportunityId: 'opp-123',
        tenantId: 'test-tenant',
        currentStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        dealValue: 50000,
        riskScore: 25,
        urgency: 'normal',
        industry: 'technology',
      };

      const assignment = experimentManager.assignOpportunity(
        opportunity,
        activeExperiment.experimentId
      );

      expect(assignment).toBeDefined();
      expect(assignment?.experimentId).toBe(activeExperiment.experimentId);
      expect(assignment?.opportunityId).toBe('opp-123');
      expect(['control', 'variant-a']).toContain(assignment?.assignedVariantId);
      expect(assignment?.assignmentConfidence).toBeGreaterThan(0);
      expect(assignment?.assignmentConfidence).toBeLessThanOrEqual(1);
    });

    it('should not assign ineligible opportunities', () => {
      const ineligibleOpportunity: any = {
        opportunityId: 'opp-456',
        tenantId: 'test-tenant',
        currentStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        dealValue: 50000,
        riskScore: 25,
        urgency: 'normal',
        industry: 'technology',
      };

      // Set traffic percentage to 0 to make ineligible
      activeExperiment.targetingCriteria.trafficPercentage = 0;

      const assignment = experimentManager.assignOpportunity(
        ineligibleOpportunity,
        activeExperiment.experimentId
      );

      expect(assignment).toBeNull();
    });

    it('should handle risk-based assignment', () => {
      // Create experiment with risk-based assignment
      const riskExperimentData = {
        name: 'Risk Experiment',
        description: 'Risk-based assignment test',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'safe',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Safe Variant',
            description: 'For low-risk opportunities',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'aggressive',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Aggressive Variant',
            description: 'For high-risk opportunities',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.RISK_BASED,
          riskThresholds: [
            {
              minRiskScore: 0,
              maxRiskScore: 50,
              variantId: 'safe',
              priority: 1,
            },
            {
              minRiskScore: 51,
              maxRiskScore: 100,
              variantId: 'aggressive',
              priority: 2,
            },
          ],
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const riskExperiment = experimentManager.createExperiment(
        riskExperimentData,
        'test-user'
      );
      experimentManager.startExperiment(
        riskExperiment.experimentId,
        'test-user'
      );

      const lowRiskOpportunity: any = {
        opportunityId: 'opp-low-risk',
        tenantId: 'test-tenant',
        currentStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        dealValue: 10000,
        riskScore: 25,
        urgency: 'low',
      };

      const assignment = experimentManager.assignOpportunity(
        lowRiskOpportunity,
        riskExperiment.experimentId
      );

      expect(assignment?.assignedVariantId).toBe('safe');
      expect(assignment?.assignmentReason).toContain('Risk score 25 in range');
    });

    it('should prevent duplicate assignments', () => {
      const opportunity: any = {
        opportunityId: 'opp-789',
        tenantId: 'test-tenant',
        currentStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        dealValue: 50000,
        riskScore: 25,
        urgency: 'normal',
      };

      const firstAssignment = experimentManager.assignOpportunity(
        opportunity,
        activeExperiment.experimentId
      );
      const secondAssignment = experimentManager.assignOpportunity(
        opportunity,
        activeExperiment.experimentId
      );

      expect(firstAssignment).toBeDefined();
      expect(secondAssignment).toEqual(firstAssignment);
    });
  });

  describe('completeExperiment and terminateExperiment', () => {
    let activeExperiment: any;

    beforeEach(() => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const created = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );
      activeExperiment = experimentManager.startExperiment(
        created.experimentId,
        'test-user'
      );
    });

    it('should complete an active experiment', () => {
      const completed = experimentManager.completeExperiment(
        activeExperiment.experimentId,
        'test-user'
      );

      expect(completed.state).toBe(ExperimentState.COMPLETED);
      expect(completed.completedAt).toBeDefined();
    });

    it('should terminate an active experiment', () => {
      const terminated = experimentManager.terminateExperiment(
        activeExperiment.experimentId,
        'test-user',
        'Test termination'
      );

      expect(terminated.state).toBe(ExperimentState.TERMINATED);
      expect(terminated.terminatedAt).toBeDefined();
    });
  });

  describe('listExperiments and getExperiment', () => {
    beforeEach(() => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      experimentManager.createExperiment(experimentData, 'test-user');
      experimentManager.createExperiment(
        { ...experimentData, name: 'Second Experiment' },
        'test-user'
      );
    });

    it('should list experiments with filtering', () => {
      const allExperiments = experimentManager.listExperiments();
      expect(allExperiments).toHaveLength(2);

      const tenantExperiments = experimentManager.listExperiments({
        tenantId: 'test-tenant',
      });
      expect(tenantExperiments).toHaveLength(2);

      const userExperiments = experimentManager.listExperiments({
        createdBy: 'test-user',
      });
      expect(userExperiments).toHaveLength(2);
    });

    it('should retrieve specific experiment', () => {
      const experiments = experimentManager.listExperiments();
      const experimentId = experiments[0].experimentId;

      const retrieved = experimentManager.getExperiment(experimentId);
      expect(retrieved).toEqual(experiments[0]);

      const nonExistent = experimentManager.getExperiment('non-existent');
      expect(nonExistent).toBeNull();
    });
  });

  describe('checkHealth', () => {
    let activeExperiment: any;

    beforeEach(() => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const created = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );
      activeExperiment = experimentManager.startExperiment(
        created.experimentId,
        'test-user'
      );
    });

    it('should check experiment health', () => {
      const health = experimentManager.checkHealth(
        activeExperiment.experimentId
      );

      expect(health.experimentId).toBe(activeExperiment.experimentId);
      expect(health.status).toBeDefined();
      expect(typeof health.assignmentRate).toBe('number');
      expect(typeof health.dataCompleteness).toBe('number');
      expect(typeof health.errorRate).toBe('number');
      expect(typeof health.safetyIncidents).toBe('number');
      expect(health.issues).toBeDefined();
      expect(health.lastChecked).toBeDefined();
    });
  });

  describe('getAuditLog', () => {
    it('should return audit events', () => {
      const experimentData = {
        name: 'Test Experiment',
        description: 'A test experiment',
        tenantId: 'test-tenant',
        variants: [
          {
            variantId: 'control',
            playbookVersion: { playbookId: 'test-playbook', version: '1.0.0' },
            displayName: 'Control',
            description: 'Control variant',
            weight: 50,
            isControl: true,
          },
          {
            variantId: 'variant-a',
            playbookVersion: { playbookId: 'test-playbook', version: '1.1.0' },
            displayName: 'Variant A',
            description: 'Test variant',
            weight: 50,
            isControl: false,
          },
        ],
        assignmentStrategy: {
          strategyType: AssignmentStrategyType.PERCENTAGE,
          percentages: { control: 50, 'variant-a': 50 },
        },
        targetingCriteria: { trafficPercentage: 100 },
        safetyConstraints: { emergencyStopEnabled: true },
      };

      const created = experimentManager.createExperiment(
        experimentData,
        'test-user'
      );
      experimentManager.startExperiment(created.experimentId, 'test-user');

      const auditLog = experimentManager.getAuditLog(created.experimentId);

      expect(auditLog).toHaveLength(2); // created + started
      expect(auditLog[0].eventType).toBe('experiment_started');
      expect(auditLog[1].eventType).toBe('experiment_created');
      expect(auditLog[0].timestamp.getTime()).toBeGreaterThan(
        auditLog[1].timestamp.getTime()
      );
    });
  });
});
