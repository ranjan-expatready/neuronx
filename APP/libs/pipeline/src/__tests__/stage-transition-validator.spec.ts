/**
 * Stage Transition Validator Tests - WI-027: Authoritative Stage Gate
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanonicalOpportunityStage, StageValidationResult } from '../types';
import { StageTransitionValidatorImpl } from '../stage-transition-validator';
import { PipelineStageRegistry } from '../pipeline-stage-registry';

// Mock pipeline registry
const mockRegistry: PipelineStageRegistry = {
  getMapping: vi.fn(),
  getAllowedTransitions: vi.fn(),
  mapGhlStageToCanonical: vi.fn(),
  hasStageMapping: vi.fn(),
  getPipelineConfiguration: vi.fn(),
};

describe('StageTransitionValidator', () => {
  let validator: StageTransitionValidatorImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new StageTransitionValidatorImpl(mockRegistry);
    validator.setEnforcementMode('monitor_only');
  });

  describe('validate - unknown stage ID', () => {
    it('should reject unknown GHL stage ID', async () => {
      // Mock registry to return null for unknown stage
      mockRegistry.mapGhlStageToCanonical.mockResolvedValue(null);
      mockRegistry.hasStageMapping.mockResolvedValue(false);

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        null,
        'unknown-ghl-stage-id',
        'ghl_webhook'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown GHL stage ID');
      expect(result.suggestedAction).toBe('log');
    });
  });

  describe('validate - invalid transition', () => {
    it('should reject invalid stage transition', async () => {
      // Mock registry to return valid canonical stages
      mockRegistry.mapGhlStageToCanonical.mockResolvedValue(
        CanonicalOpportunityStage.CLOSED_WON
      );
      mockRegistry.getAllowedTransitions.mockResolvedValue({
        [CanonicalOpportunityStage.PROSPECT_IDENTIFIED]: [
          CanonicalOpportunityStage.INITIAL_CONTACT,
        ],
      });

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        CanonicalOpportunityStage.PROSPECT_IDENTIFIED, // current
        'won-stage-id', // requested
        'ghl_webhook'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid transition');
      expect(result.canonicalStage).toBe(CanonicalOpportunityStage.CLOSED_WON);
    });
  });

  describe('validate - valid transition', () => {
    it('should accept valid stage transition', async () => {
      mockRegistry.mapGhlStageToCanonical.mockResolvedValue(
        CanonicalOpportunityStage.INITIAL_CONTACT
      );
      mockRegistry.getAllowedTransitions.mockResolvedValue({
        [CanonicalOpportunityStage.PROSPECT_IDENTIFIED]: [
          CanonicalOpportunityStage.INITIAL_CONTACT,
        ],
      });

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        'contact-stage-id',
        'ghl_webhook'
      );

      expect(result.allowed).toBe(true);
      expect(result.canonicalStage).toBe(
        CanonicalOpportunityStage.INITIAL_CONTACT
      );
    });
  });

  describe('validate - initial assignment', () => {
    it('should allow any stage for initial assignment (null current stage)', async () => {
      mockRegistry.mapGhlStageToCanonical.mockResolvedValue(
        CanonicalOpportunityStage.CLOSED_WON
      );

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        null, // no current stage
        'won-stage-id',
        'ghl_webhook'
      );

      expect(result.allowed).toBe(true);
      expect(result.canonicalStage).toBe(CanonicalOpportunityStage.CLOSED_WON);
    });
  });

  describe('enforcement modes', () => {
    it('should log but allow invalid transitions in monitor_only mode', async () => {
      validator.setEnforcementMode('monitor_only');
      mockRegistry.mapGhlStageToCanonical.mockResolvedValue(
        CanonicalOpportunityStage.CLOSED_WON
      );
      mockRegistry.getAllowedTransitions.mockResolvedValue({
        [CanonicalOpportunityStage.PROSPECT_IDENTIFIED]: [
          CanonicalOpportunityStage.INITIAL_CONTACT,
        ],
      });

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        'won-stage-id',
        'ghl_webhook'
      );

      expect(result.allowed).toBe(false);
      expect(result.suggestedAction).toBe('log');
      expect(validator.shouldEnforce()).toBe(false);
    });

    it('should block invalid transitions in block mode', async () => {
      validator.setEnforcementMode('block');
      mockRegistry.mapGhlStageToCanonical.mockResolvedValue(
        CanonicalOpportunityStage.CLOSED_WON
      );
      mockRegistry.getAllowedTransitions.mockResolvedValue({
        [CanonicalOpportunityStage.PROSPECT_IDENTIFIED]: [
          CanonicalOpportunityStage.INITIAL_CONTACT,
        ],
      });

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
        'won-stage-id',
        'ghl_webhook'
      );

      expect(result.allowed).toBe(false);
      expect(result.suggestedAction).toBe('block');
      expect(validator.shouldEnforce()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle registry errors gracefully', async () => {
      mockRegistry.mapGhlStageToCanonical.mockRejectedValue(
        new Error('Registry error')
      );

      const result = await validator.validate(
        'tenant-123',
        'pipeline-456',
        null,
        'some-stage-id',
        'ghl_webhook'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Validation error');
    });
  });
});
