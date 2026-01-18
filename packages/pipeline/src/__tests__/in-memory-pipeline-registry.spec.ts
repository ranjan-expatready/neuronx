/**
 * In-Memory Pipeline Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalOpportunityStage } from '../types';
import { InMemoryPipelineStageRegistry } from '../in-memory-pipeline-registry';

describe('InMemoryPipelineStageRegistry', () => {
  let registry: InMemoryPipelineStageRegistry;

  beforeEach(() => {
    registry = new InMemoryPipelineStageRegistry();
  });

  describe('getMapping', () => {
    it('should return default pipeline stages for unknown tenant', async () => {
      const mappings = await registry.getMapping('unknown-tenant', 'default');

      expect(mappings).toHaveLength(9); // Default configuration has 9 stages
      expect(mappings[0]).toEqual({
        ghlStageId: 'prospect',
        canonicalStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
      });
    });
  });

  describe('mapGhlStageToCanonical', () => {
    it('should map known GHL stage to canonical stage', async () => {
      const canonicalStage = await registry.mapGhlStageToCanonical(
        'tenant-123',
        'default',
        'qualified'
      );

      expect(canonicalStage).toBe(CanonicalOpportunityStage.QUALIFIED);
    });

    it('should return null for unknown GHL stage', async () => {
      const canonicalStage = await registry.mapGhlStageToCanonical(
        'tenant-123',
        'default',
        'unknown-stage'
      );

      expect(canonicalStage).toBeNull();
    });
  });

  describe('hasStageMapping', () => {
    it('should return true for known stage mappings', async () => {
      const hasMapping = await registry.hasStageMapping(
        'tenant-123',
        'default',
        'won'
      );

      expect(hasMapping).toBe(true);
    });

    it('should return false for unknown stage mappings', async () => {
      const hasMapping = await registry.hasStageMapping(
        'tenant-123',
        'default',
        'unknown-stage'
      );

      expect(hasMapping).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions for default pipeline', async () => {
      const transitions = await registry.getAllowedTransitions(
        'tenant-123',
        'default'
      );

      expect(
        transitions[CanonicalOpportunityStage.PROSPECT_IDENTIFIED]
      ).toEqual([
        CanonicalOpportunityStage.INITIAL_CONTACT,
        CanonicalOpportunityStage.QUALIFIED,
      ]);

      expect(transitions[CanonicalOpportunityStage.CLOSED_WON]).toEqual([]);
    });
  });

  describe('getPipelineConfiguration', () => {
    it('should return default configuration for unknown tenant', async () => {
      const config = await registry.getPipelineConfiguration(
        'unknown-tenant',
        'default'
      );

      expect(config).toBeDefined();
      expect(config?.tenantId).toBe('unknown-tenant');
      expect(config?.pipelineId).toBe('default');
      expect(config?.stages).toHaveLength(9);
    });
  });

  describe('setPipelineConfiguration', () => {
    it('should store custom pipeline configuration', async () => {
      const customConfig = {
        tenantId: 'tenant-123',
        pipelineId: 'custom',
        name: 'Custom Pipeline',
        stages: [
          {
            ghlStageId: 'custom-stage',
            canonicalStage: CanonicalOpportunityStage.CLOSED_WON,
          },
        ],
        allowedTransitions: {
          [CanonicalOpportunityStage.CLOSED_WON]: [],
        },
      };

      registry.setPipelineConfiguration(customConfig);

      const retrieved = await registry.getPipelineConfiguration(
        'tenant-123',
        'custom'
      );
      expect(retrieved).toEqual(customConfig);

      const customStage = await registry.mapGhlStageToCanonical(
        'tenant-123',
        'custom',
        'custom-stage'
      );
      expect(customStage).toBe(CanonicalOpportunityStage.CLOSED_WON);
    });
  });
});
