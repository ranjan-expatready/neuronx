/**
 * Outcome Tracker Tests - WI-031: Playbook Experimentation & Outcome Intelligence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OutcomeTracker } from '../outcome-tracker';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

describe('OutcomeTracker', () => {
  let outcomeTracker: OutcomeTracker;

  beforeEach(() => {
    outcomeTracker = new OutcomeTracker();
  });

  describe('recordOutcomeEvent', () => {
    it('should record outcome events', () => {
      const event = outcomeTracker.recordOutcomeEvent(
        'exp-123',
        'opp-456',
        'variant-a',
        'stage_reached',
        { stage: CanonicalOpportunityStage.QUALIFIED },
        'tenant-1',
        'corr-789'
      );

      expect(event.eventId).toBeDefined();
      expect(event.experimentId).toBe('exp-123');
      expect(event.opportunityId).toBe('opp-456');
      expect(event.variantId).toBe('variant-a');
      expect(event.eventType).toBe('stage_reached');
      expect(event.eventData.stage).toBe(CanonicalOpportunityStage.QUALIFIED);
      expect(event.correlationId).toBe('corr-789');
    });
  });

  describe('recordOpportunityOutcome', () => {
    it('should record complete opportunity outcomes', () => {
      const outcome = {
        opportunityId: 'opp-456',
        experimentId: 'exp-123',
        variantId: 'variant-a',
        tenantId: 'tenant-1',
        finalStage: CanonicalOpportunityStage.CLOSED_WON,
        reachedTargetStage: true,
        startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        completedAt: new Date(),
        totalInteractions: 5,
        successfulInteractions: 4,
        failedInteractions: 1,
        complianceScore: 85,
        riskIncidents: 0,
        safetyViolations: 0,
        totalCost: 150.5,
      };

      outcomeTracker.recordOpportunityOutcome(outcome);

      const retrieved = outcomeTracker.getOpportunityOutcome(
        'exp-123',
        'opp-456'
      );
      expect(retrieved).toBeDefined();
      expect(retrieved?.finalStage).toBe(CanonicalOpportunityStage.CLOSED_WON);
      expect(retrieved?.reachedTargetStage).toBe(true);
      expect(retrieved?.totalDurationMinutes).toBeDefined();
    });

    it('should automatically record conversion event', () => {
      const outcome = {
        opportunityId: 'opp-456',
        experimentId: 'exp-123',
        variantId: 'variant-a',
        tenantId: 'tenant-1',
        finalStage: CanonicalOpportunityStage.CLOSED_WON,
        reachedTargetStage: true,
        startedAt: new Date(),
        totalInteractions: 3,
        successfulInteractions: 3,
        failedInteractions: 0,
      };

      outcomeTracker.recordOpportunityOutcome(outcome);

      const events = outcomeTracker.getOpportunityEvents('exp-123', 'opp-456');
      const conversionEvent = events.find(e => e.eventType === 'conversion');

      expect(conversionEvent).toBeDefined();
      expect(conversionEvent?.eventData.reachedTargetStage).toBe(true);
      expect(conversionEvent?.eventData.totalInteractions).toBe(3);
    });
  });

  describe('getOpportunityEvents and getOpportunityOutcome', () => {
    beforeEach(() => {
      // Record some events
      outcomeTracker.recordOutcomeEvent(
        'exp-123',
        'opp-456',
        'variant-a',
        'stage_reached',
        { stage: CanonicalOpportunityStage.INITIAL_CONTACT }
      );

      outcomeTracker.recordOutcomeEvent(
        'exp-123',
        'opp-456',
        'variant-a',
        'interaction_completed',
        { success: true, type: 'call' }
      );

      // Record outcome
      outcomeTracker.recordOpportunityOutcome({
        opportunityId: 'opp-456',
        experimentId: 'exp-123',
        variantId: 'variant-a',
        finalStage: CanonicalOpportunityStage.CLOSED_WON,
        reachedTargetStage: true,
        startedAt: new Date(),
        totalInteractions: 2,
        successfulInteractions: 2,
        failedInteractions: 0,
      });
    });

    it('should retrieve opportunity events', () => {
      const events = outcomeTracker.getOpportunityEvents('exp-123', 'opp-456');

      expect(events).toHaveLength(3); // 2 manual + 1 automatic conversion
      expect(events[0].eventType).toBe('conversion'); // Most recent first
      expect(events[1].eventType).toBe('interaction_completed');
      expect(events[2].eventType).toBe('stage_reached');
    });

    it('should retrieve opportunity outcome', () => {
      const outcome = outcomeTracker.getOpportunityOutcome(
        'exp-123',
        'opp-456'
      );

      expect(outcome).toBeDefined();
      expect(outcome?.opportunityId).toBe('opp-456');
      expect(outcome?.experimentId).toBe('exp-123');
      expect(outcome?.variantId).toBe('variant-a');
      expect(outcome?.finalStage).toBe(CanonicalOpportunityStage.CLOSED_WON);
    });
  });

  describe('generateExperimentResults', () => {
    beforeEach(() => {
      // Create mock data for two variants
      const controlOutcomes = ['opp-1', 'opp-2', 'opp-3'].map(
        (oppId, index) => ({
          opportunityId: oppId,
          experimentId: 'exp-123',
          variantId: 'control',
          finalStage:
            index < 2
              ? CanonicalOpportunityStage.CLOSED_WON
              : CanonicalOpportunityStage.LOST,
          reachedTargetStage: index < 2,
          startedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
          completedAt: new Date(),
          totalInteractions: 3 + index,
          successfulInteractions: 2 + index,
          failedInteractions: 1,
          complianceScore: 80 + index * 5,
          riskIncidents: 0,
          safetyViolations: 0,
        })
      );

      const variantAOutcomes = ['opp-4', 'opp-5', 'opp-6'].map(
        (oppId, index) => ({
          opportunityId: oppId,
          experimentId: 'exp-123',
          variantId: 'variant-a',
          finalStage:
            index < 2
              ? CanonicalOpportunityStage.CLOSED_WON
              : CanonicalOpportunityStage.LOST,
          reachedTargetStage: index < 2,
          startedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
          completedAt: new Date(),
          totalInteractions: 4 + index,
          successfulInteractions: 3 + index,
          failedInteractions: 1,
          complianceScore: 85 + index * 5,
          riskIncidents: 0,
          safetyViolations: 0,
        })
      );

      [...controlOutcomes, ...variantAOutcomes].forEach(outcome =>
        outcomeTracker.recordOpportunityOutcome(outcome)
      );
    });

    it('should generate experiment results', () => {
      const variantMap = {
        control: ['opp-1', 'opp-2', 'opp-3'],
        'variant-a': ['opp-4', 'opp-5', 'opp-6'],
      };

      const results = outcomeTracker.generateExperimentResults(
        'exp-123',
        variantMap
      );

      expect(results.experimentId).toBe('exp-123');
      expect(Object.keys(results.variantResults)).toHaveLength(2);
      expect(results.variantResults.control).toBeDefined();
      expect(results.variantResults['variant-a']).toBeDefined();

      // Check control variant results
      const controlResults = results.variantResults.control;
      expect(controlResults.variantId).toBe('control');
      expect(controlResults.sampleSize).toBe(3);
      expect(controlResults.conversionRate).toBe(2 / 3); // 2 out of 3 converted

      // Check variant-a results
      const variantAResults = results.variantResults['variant-a'];
      expect(variantAResults.variantId).toBe('variant-a');
      expect(variantAResults.sampleSize).toBe(3);
      expect(variantAResults.conversionRate).toBe(2 / 3);

      // Check overall metrics
      expect(results.overallMetrics.totalSampleSize).toBe(6);
      expect(results.overallMetrics.averageConversionRate).toBe(4 / 6);
    });

    it('should calculate statistical measures', () => {
      const variantMap = {
        control: ['opp-1', 'opp-2', 'opp-3'],
      };

      const results = outcomeTracker.generateExperimentResults(
        'exp-123',
        variantMap
      );

      const controlResults = results.variantResults.control;

      // Check that statistical measures are calculated
      expect(controlResults.mean).toBeDefined();
      expect(controlResults.median).toBeDefined();
      expect(controlResults.standardDeviation).toBeDefined();
      expect(controlResults.confidenceInterval95).toBeDefined();

      // Check specific metrics
      expect(controlResults.mean.conversionTimeMinutes).toBeDefined();
      expect(controlResults.mean.totalInteractions).toBeDefined();
      expect(controlResults.mean.complianceScore).toBeDefined();
    });
  });

  describe('getAuditLog', () => {
    it('should return audit events', () => {
      outcomeTracker.recordOutcomeEvent(
        'exp-123',
        'opp-456',
        'variant-a',
        'conversion',
        { success: true }
      );

      const auditLog = outcomeTracker.getAuditLog('exp-123');

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].eventType).toBe('outcome_recorded');
      expect(auditLog[0].experimentId).toBe('exp-123');
    });
  });
});
