/**
 * Base Drift Detector - WI-053: Drift Detection Engine
 *
 * Common functionality for detecting drift between GHL snapshots.
 */

import { Injectable } from '@nestjs/common';
import { DriftDetector, DriftChange, DriftChangeType } from '../drift-types';

/**
 * Base class for drift detectors with common functionality
 */
@Injectable()
export abstract class BaseDriftDetector implements DriftDetector {
  /**
   * Main drift detection method to be implemented by subclasses
   */
  abstract detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]>;

  /**
   * Create entity map for efficient lookup by ID
   */
  protected createEntityMap(
    entities: any[],
    idField: string = 'id'
  ): Map<string, any> {
    const entityMap = new Map<string, any>();

    if (!Array.isArray(entities)) {
      return entityMap;
    }

    for (const entity of entities) {
      if (entity && entity[idField]) {
        entityMap.set(entity[idField], entity);
      }
    }

    return entityMap;
  }

  /**
   * Detect changes between two entity collections
   */
  protected detectEntityChanges(
    beforeEntities: any[],
    afterEntities: any[],
    entityType: string,
    idField: string = 'id'
  ): DriftChange[] {
    const changes: DriftChange[] = [];
    const beforeMap = this.createEntityMap(beforeEntities, idField);
    const afterMap = this.createEntityMap(afterEntities, idField);

    // Find added entities
    for (const [id, entity] of afterMap) {
      if (!beforeMap.has(id)) {
        changes.push({
          changeType: DriftChangeType.ADDED,
          entityId: id,
          entityType,
          diffPath: `root`,
          afterValue: entity,
          category: 'COSMETIC_DRIFT' as any, // Will be reclassified
          severity: 'LOW' as any,
          description: `${entityType} '${id}' was added`,
        });
      }
    }

    // Find removed entities
    for (const [id, entity] of beforeMap) {
      if (!afterMap.has(id)) {
        changes.push({
          changeType: DriftChangeType.REMOVED,
          entityId: id,
          entityType,
          diffPath: `root`,
          beforeValue: entity,
          category: 'COSMETIC_DRIFT' as any, // Will be reclassified
          severity: 'LOW' as any,
          description: `${entityType} '${id}' was removed`,
        });
      }
    }

    // Find modified entities
    for (const [id, beforeEntity] of beforeMap) {
      const afterEntity = afterMap.get(id);
      if (afterEntity) {
        const fieldChanges = this.detectFieldChanges(
          beforeEntity,
          afterEntity,
          `${entityType}[${id}]`
        );
        changes.push(...fieldChanges);
      }
    }

    return changes;
  }

  /**
   * Detect changes in individual fields
   */
  protected detectFieldChanges(
    beforeEntity: any,
    afterEntity: any,
    pathPrefix: string
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    // Get all unique field names
    const allFields = new Set([
      ...Object.keys(beforeEntity || {}),
      ...Object.keys(afterEntity || {}),
    ]);

    for (const field of allFields) {
      const beforeValue = beforeEntity?.[field];
      const afterValue = afterEntity?.[field];

      // Skip ID fields for modification detection (handled by add/remove)
      if (field === 'id' || field === 'entityId') {
        continue;
      }

      // Check if values are different
      if (!this.valuesEqual(beforeValue, afterValue)) {
        const entityType = this.extractEntityType(pathPrefix);
        const entityId = this.extractEntityId(
          pathPrefix,
          beforeEntity,
          afterEntity
        );

        changes.push({
          changeType: DriftChangeType.MODIFIED,
          entityId,
          entityType,
          diffPath: `${pathPrefix}.${field}`,
          beforeValue,
          afterValue,
          category: 'COSMETIC_DRIFT' as any, // Will be reclassified
          severity: 'LOW' as any,
          description: `Field '${field}' changed from '${JSON.stringify(beforeValue)}' to '${JSON.stringify(afterValue)}'`,
        });
      }
    }

    return changes;
  }

  /**
   * Deep equality check for values
   */
  private valuesEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      // For objects, do a deep comparison of primitive values
      // Complex nested structures are treated as different if any primitive field differs
      return this.deepPrimitiveEqual(a, b);
    }

    return false;
  }

  /**
   * Deep equality for primitive values in objects
   */
  private deepPrimitiveEqual(obj1: any, obj2: any): boolean {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      const val1 = obj1[key];
      const val2 = obj2[key];

      if (typeof val1 === 'object' && val1 !== null) {
        if (typeof val2 === 'object' && val2 !== null) {
          if (!this.deepPrimitiveEqual(val1, val2)) return false;
        } else {
          return false;
        }
      } else if (val1 !== val2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract entity type from path
   */
  private extractEntityType(path: string): string {
    // Extract entity type from path like "locations[loc_001]"
    const match = path.match(/^(\w+)\[/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extract entity ID from path or entities
   */
  private extractEntityId(
    path: string,
    beforeEntity: any,
    afterEntity: any
  ): string {
    // Try to extract from path first
    const pathMatch = path.match(/\[([^\]]+)\]/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Fall back to entity ID fields
    return beforeEntity?.id || afterEntity?.id || 'unknown';
  }

  /**
   * Create a standardized drift change
   */
  protected createDriftChange(
    changeType: DriftChangeType,
    entityId: string,
    entityType: string,
    diffPath: string,
    beforeValue?: any,
    afterValue?: any,
    description?: string
  ): DriftChange {
    return {
      changeType,
      entityId,
      entityType,
      diffPath,
      beforeValue,
      afterValue,
      category: 'COSMETIC_DRIFT' as any, // Will be reclassified
      severity: 'LOW' as any,
      description:
        description || `${changeType} ${entityType} ${entityId} at ${diffPath}`,
    };
  }
}
