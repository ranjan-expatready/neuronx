/**
 * Base Drift Comparator - WI-053: GHL Drift Detection Engine
 *
 * Common functionality for all snapshot type comparators.
 */

import { Injectable, Logger } from '@nestjs/common';
import { GhlSnapshot, SnapshotType } from '@neuronx/ghl-snapshots';
import {
  DriftDetection,
  DriftChangeType,
  DriftCategory,
  DriftSeverity,
  classifyDriftCategory,
  assessDriftSeverity,
} from '../drift-types';

@Injectable()
export abstract class BaseDriftComparator {
  protected readonly logger: Logger;

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Compare two snapshots and detect drift
   */
  abstract compare(
    beforeSnapshot: GhlSnapshot,
    afterSnapshot: GhlSnapshot
  ): Promise<DriftDetection[]>;

  /**
   * Get the snapshot type this comparator handles
   */
  abstract getSnapshotType(): SnapshotType;

  /**
   * Get entity ID from GHL entity data
   */
  protected abstract getEntityId(entity: any): string;

  /**
   * Get entity type name for this comparator
   */
  protected abstract getEntityType(): string;

  /**
   * Compare entities and detect changes
   */
  protected compareEntities(
    beforeData: any[],
    afterData: any[]
  ): DriftDetection[] {
    const detections: DriftDetection[] = [];

    // Create maps for efficient lookup
    const beforeMap = new Map<string, any>();
    const afterMap = new Map<string, any>();

    beforeData.forEach(entity => {
      const id = this.getEntityId(entity);
      beforeMap.set(id, entity);
    });

    afterData.forEach(entity => {
      const id = this.getEntityId(entity);
      afterMap.set(id, entity);
    });

    // Find added entities
    for (const [id, entity] of afterMap) {
      if (!beforeMap.has(id)) {
        detections.push(
          this.createDriftDetection(
            id,
            DriftChangeType.ADDED,
            `data[${this.findEntityIndex(afterData, id)}]`,
            undefined,
            entity,
            `New ${this.getEntityType()} added`
          )
        );
      }
    }

    // Find removed entities
    for (const [id, entity] of beforeMap) {
      if (!afterMap.has(id)) {
        detections.push(
          this.createDriftDetection(
            id,
            DriftChangeType.REMOVED,
            `data[${this.findEntityIndex(beforeData, id)}]`,
            entity,
            undefined,
            `${this.getEntityType()} removed`
          )
        );
      }
    }

    // Find modified entities
    for (const [id, beforeEntity] of beforeMap) {
      const afterEntity = afterMap.get(id);
      if (afterEntity) {
        const modifications = this.compareEntityFields(
          beforeEntity,
          afterEntity,
          id
        );
        detections.push(...modifications);
      }
    }

    return detections;
  }

  /**
   * Compare individual entity fields and detect modifications
   */
  protected compareEntityFields(
    beforeEntity: any,
    afterEntity: any,
    entityId: string
  ): DriftDetection[] {
    const detections: DriftDetection[] = [];

    // Perform deep comparison of all fields
    const fieldChanges = this.deepCompare(beforeEntity, afterEntity, '');

    fieldChanges.forEach(change => {
      detections.push(
        this.createDriftDetection(
          entityId,
          DriftChangeType.MODIFIED,
          change.path,
          change.beforeValue,
          change.afterValue,
          `${this.getEntityType()} field modified: ${change.path}`
        )
      );
    });

    return detections;
  }

  /**
   * Perform deep comparison of objects and return field-level changes
   */
  private deepCompare(
    before: any,
    after: any,
    path: string
  ): Array<{
    path: string;
    beforeValue: any;
    afterValue: any;
  }> {
    const changes: Array<{ path: string; beforeValue: any; afterValue: any }> =
      [];

    // Handle primitive values and null/undefined
    if (before === after) {
      return changes;
    }

    // Handle type changes
    if (typeof before !== typeof after) {
      return [{ path, beforeValue: before, afterValue: after }];
    }

    // Handle arrays
    if (Array.isArray(before) && Array.isArray(after)) {
      return this.compareArrays(before, after, path);
    }

    // Handle objects
    if (
      typeof before === 'object' &&
      typeof after === 'object' &&
      before !== null &&
      after !== null
    ) {
      return this.compareObjects(before, after, path);
    }

    // Primitive value change
    return [{ path, beforeValue: before, afterValue: after }];
  }

  /**
   * Compare arrays
   */
  private compareArrays(
    before: any[],
    after: any[],
    path: string
  ): Array<{
    path: string;
    beforeValue: any;
    afterValue: any;
  }> {
    const changes: Array<{ path: string; beforeValue: any; afterValue: any }> =
      [];

    // Simple length change
    if (before.length !== after.length) {
      changes.push({
        path: `${path}.length`,
        beforeValue: before.length,
        afterValue: after.length,
      });
    }

    // Compare elements at same indices
    const maxLength = Math.max(before.length, after.length);
    for (let i = 0; i < maxLength; i++) {
      const elementPath = `${path}[${i}]`;
      if (i >= before.length) {
        changes.push({
          path: elementPath,
          beforeValue: undefined,
          afterValue: after[i],
        });
      } else if (i >= after.length) {
        changes.push({
          path: elementPath,
          beforeValue: before[i],
          afterValue: undefined,
        });
      } else {
        changes.push(...this.deepCompare(before[i], after[i], elementPath));
      }
    }

    return changes;
  }

  /**
   * Compare objects
   */
  private compareObjects(
    before: Record<string, any>,
    after: Record<string, any>,
    path: string
  ): Array<{
    path: string;
    beforeValue: any;
    afterValue: any;
  }> {
    const changes: Array<{ path: string; beforeValue: any; afterValue: any }> =
      [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      const beforeValue = before[key];
      const afterValue = after[key];

      if (!(key in before)) {
        changes.push({
          path: keyPath,
          beforeValue: undefined,
          afterValue,
        });
      } else if (!(key in after)) {
        changes.push({
          path: keyPath,
          beforeValue,
          afterValue: undefined,
        });
      } else {
        changes.push(...this.deepCompare(beforeValue, afterValue, keyPath));
      }
    }

    return changes;
  }

  /**
   * Create a drift detection result
   */
  protected createDriftDetection(
    entityId: string,
    changeType: DriftChangeType,
    diffPath: string,
    beforeValue: any,
    afterValue: any,
    impactAssessment: string,
    severity?: DriftSeverity
  ): DriftDetection {
    const category = classifyDriftCategory(
      this.getSnapshotType(),
      diffPath,
      changeType
    );
    const finalSeverity = severity || assessDriftSeverity(
      category,
      changeType,
      diffPath,
      this.getEntityType()
    );

    return {
      entityId,
      entityType: this.getEntityType(),
      changeType,
      category,
      severity: finalSeverity,
      diffPath,
      beforeValue,
      afterValue,
      description: impactAssessment,
      impactAssessment,
      metadata: {
        isBreakingChange: this.isBreakingChange(changeType, diffPath, finalSeverity),
        requiresReview: this.requiresReview(finalSeverity, category),
        affectedEntities: this.getAffectedEntities(entityId, diffPath),
        policyImplications: this.getPolicyImplications(diffPath, category),
      },
    } as DriftDetection;
  }

  /**
   * Determine if a change is breaking
   */
  private isBreakingChange(
    changeType: DriftChangeType,
    diffPath: string,
    severity: DriftSeverity
  ): boolean {
    if (severity === DriftSeverity.CRITICAL) {
      return true;
    }

    if (changeType === DriftChangeType.REMOVED) {
      return true;
    }

    // ID changes are always breaking
    if (diffPath.includes('id') && changeType === DriftChangeType.MODIFIED) {
      return true;
    }

    return false;
  }

  /**
   * Determine if a change requires review
   */
  private requiresReview(
    severity: DriftSeverity,
    category: DriftCategory
  ): boolean {
    return (
      severity === DriftSeverity.CRITICAL ||
      severity === DriftSeverity.HIGH ||
      category === DriftCategory.CAPABILITY_DRIFT
    );
  }

  /**
   * Get affected entities for a change
   */
  private getAffectedEntities(entityId: string, _diffPath: string): string[] {
    // In a real implementation, this would analyze relationships
    // For now, just return the primary entity
    return [entityId];
  }

  /**
   * Get policy implications for a change
   */
  private getPolicyImplications(
    diffPath: string,
    category: DriftCategory
  ): string[] {
    const implications: string[] = [];

    if (category === DriftCategory.CAPABILITY_DRIFT) {
      implications.push('Capability access policies may need review');
    }

    if (category === DriftCategory.STRUCTURAL_DRIFT) {
      implications.push('Workflow and automation rules may be affected');
    }

    if (diffPath.includes('isActive')) {
      implications.push('Activation status changes may impact availability');
    }

    return implications;
  }

  /**
   * Find the index of an entity in an array by ID
   */
  private findEntityIndex(entities: any[], targetId: string): number {
    return entities.findIndex(entity => this.getEntityId(entity) === targetId);
  }
}
