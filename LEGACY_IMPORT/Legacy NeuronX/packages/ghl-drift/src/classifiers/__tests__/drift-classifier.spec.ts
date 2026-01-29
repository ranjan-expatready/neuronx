import { DriftClassifier } from '../drift-classifier';
import {
  DriftChange,
  DriftChangeType,
  DriftCategory,
  DriftSeverity,
} from '../../drift-types';
import { describe, it, expect } from 'vitest';

describe('DriftClassifier', () => {
  let classifier: DriftClassifier;

  beforeEach(() => {
    classifier = new DriftClassifier();
  });

  describe('classifyChange', () => {
    it('should classify pipeline stage removal as structural drift', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.REMOVED,
        entityId: 'stage_1',
        entityType: 'pipeline_stage',
        diffPath: 'pipeline[pipe_1].stages',
        beforeValue: { id: 'stage_1', name: 'Lead' },
        description: 'Pipeline stage removed',
      };

      const result = classifier.classifyChange(change);

      expect(result.category).toBe(DriftCategory.STRUCTURAL_DRIFT);
      expect(result.severity).toBe(DriftSeverity.HIGH);
    });

    it('should classify AI worker capability changes as capability drift', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.MODIFIED,
        entityId: 'aiw_1',
        entityType: 'ai_worker_capability',
        diffPath: 'ai_worker[aiw_1].capabilities',
        beforeValue: ['qualification'],
        afterValue: ['qualification', 'scheduling'],
        description: 'AI worker capability added',
      };

      const result = classifier.classifyChange(change);

      expect(result.category).toBe(DriftCategory.CAPABILITY_DRIFT);
      expect(result.severity).toBe(DriftSeverity.CRITICAL);
    });

    it('should classify workflow trigger changes as config drift', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.MODIFIED,
        entityId: 'wf_1',
        entityType: 'workflow',
        diffPath: 'workflow[wf_1].trigger.conditions',
        beforeValue: [
          { field: 'source', operator: 'equals', value: 'website' },
        ],
        afterValue: [{ field: 'source', operator: 'equals', value: 'social' }],
        description: 'Workflow trigger condition changed',
      };

      const result = classifier.classifyChange(change);

      expect(result.category).toBe(DriftCategory.CONFIG_DRIFT);
      expect(result.severity).toBe(DriftSeverity.MEDIUM);
    });

    it('should classify location cosmetic changes as cosmetic drift', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.MODIFIED,
        entityId: 'loc_1',
        entityType: 'location',
        diffPath: 'location[loc_1].description',
        beforeValue: 'Old description',
        afterValue: 'New description',
        description: 'Location description changed',
      };

      const result = classifier.classifyChange(change);

      expect(result.category).toBe(DriftCategory.COSMETIC_DRIFT);
      expect(result.severity).toBe(DriftSeverity.LOW);
    });

    it('should classify unknown entity types as cosmetic drift', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.MODIFIED,
        entityId: 'unknown_1',
        entityType: 'unknown_entity',
        diffPath: 'unknown.path',
        beforeValue: 'old',
        afterValue: 'new',
        description: 'Unknown entity changed',
      };

      const result = classifier.classifyChange(change);

      expect(result.category).toBe(DriftCategory.COSMETIC_DRIFT);
      expect(result.severity).toBe(DriftSeverity.LOW);
    });
  });

  describe('severity classification', () => {
    it('should classify entity removal as high severity for most types', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.REMOVED,
        entityId: 'cal_1',
        entityType: 'calendar',
        diffPath: 'calendars',
        beforeValue: { id: 'cal_1', name: 'Main Calendar' },
        description: 'Calendar removed',
      };

      const result = classifier.classifyChange(change);

      expect(result.severity).toBe(DriftSeverity.HIGH);
    });

    it('should classify entity addition as medium severity', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.ADDED,
        entityId: 'wf_2',
        entityType: 'workflow',
        diffPath: 'workflows',
        afterValue: { id: 'wf_2', name: 'New Workflow' },
        description: 'Workflow added',
      };

      const result = classifier.classifyChange(change);

      expect(result.severity).toBe(DriftSeverity.MEDIUM);
    });

    it('should classify AI worker addition as high severity', () => {
      const change: Omit<DriftChange, 'category' | 'severity'> = {
        changeType: DriftChangeType.ADDED,
        entityId: 'aiw_1',
        entityType: 'ai_worker',
        diffPath: 'ai_workers',
        afterValue: { id: 'aiw_1', name: 'New AI Worker' },
        description: 'AI worker added',
      };

      const result = classifier.classifyChange(change);

      expect(result.severity).toBe(DriftSeverity.HIGH);
    });
  });
});
