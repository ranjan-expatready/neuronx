import type {
  GhlViolation,
  GhlViolationRecord,
  ViolationType,
  ViolationSeverity,
  EntityType,
  BoundaryAnalysisResult,
} from './ghl-violation.types';

/**
 * Interface for storing GHL boundary violations immutably
 * Violations are audit records that cannot be modified once created
 */
export interface GhlViolationStore {
  /**
   * Store multiple violations atomically
   * Returns the stored violation records
   */
  storeViolations(
    analysisResult: BoundaryAnalysisResult
  ): Promise<GhlViolationRecord[]>;

  /**
   * Store a single violation
   * Returns the stored violation record
   */
  storeViolation(violation: GhlViolation): Promise<GhlViolationRecord>;

  /**
   * Query violations by tenant
   */
  findByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      severity?: ViolationSeverity[];
      violationType?: ViolationType[];
      entityType?: EntityType[];
      since?: Date;
      until?: Date;
    }
  ): Promise<GhlViolationRecord[]>;

  /**
   * Query violations by snapshot
   */
  findBySnapshot(
    tenantId: string,
    snapshotId: string
  ): Promise<GhlViolationRecord[]>;

  /**
   * Query violations for a specific entity
   */
  findByEntity(
    tenantId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<GhlViolationRecord[]>;

  /**
   * Get violation summary for a tenant
   */
  getViolationSummary(
    tenantId: string,
    since?: Date
  ): Promise<{
    totalViolations: number;
    violationsBySeverity: Record<ViolationSeverity, number>;
    violationsByType: Record<ViolationType, number>;
    violationsByEntityType: Record<EntityType, number>;
    mostRecentViolation?: Date;
  }>;

  /**
   * Check if tenant has blocking violations
   * Returns true if tenant should be blocked based on HIGH/CRITICAL violations
   */
  hasBlockingViolations(tenantId: string): Promise<boolean>;
}

/**
 * Error thrown when attempting to modify immutable violations
 */
export class ViolationImmutabilityError extends Error {
  constructor(operation: string) {
    super(
      `Violation immutability violation: ${operation} not allowed on stored violations`
    );
    this.name = 'ViolationImmutabilityError';
  }
}

/**
 * Prisma-based implementation of GhlViolationStore
 * Enforces immutability by only providing create operations
 */
export class PrismaGhlViolationStore implements GhlViolationStore {
  constructor(private readonly prisma: any) {} // TODO: Import proper Prisma type

  async storeViolations(
    analysisResult: BoundaryAnalysisResult
  ): Promise<GhlViolationRecord[]> {
    const { tenantId, snapshotId, correlationId, policyVersion, violations } =
      analysisResult;

    // Prepare violation records for bulk insert
    const violationRecords = violations.map(violation => ({
      tenantId,
      snapshotId,
      violationId: violation.violationId,
      violationType: violation.violationType,
      severity: violation.severity,
      entityType: violation.entityType,
      entityId: violation.entityId,
      path: violation.path,
      evidence: violation.evidence,
      policyVersion,
      correlationId,
      metadata: {
        ...violation.metadata,
        detectedAt: violation.detectedAt,
        analysisDuration: analysisResult.analysisDuration,
        entityCount: analysisResult.entityCount,
      },
    }));

    // Bulk insert with conflict resolution (skip duplicates)
    const storedRecords = await this.prisma.ghlViolation.createManyAndReturn({
      data: violationRecords,
      skipDuplicates: true, // Prevent duplicate violationIds
    });

    return storedRecords;
  }

  async storeViolation(violation: GhlViolation): Promise<GhlViolationRecord> {
    const record = await this.prisma.ghlViolation.create({
      data: {
        tenantId: violation.tenantId,
        snapshotId: violation.snapshotId,
        violationId: violation.violationId,
        violationType: violation.violationType,
        severity: violation.severity,
        entityType: violation.entityType,
        entityId: violation.entityId,
        path: violation.path,
        evidence: violation.evidence,
        policyVersion: violation.policyVersion,
        correlationId: violation.correlationId,
        metadata: {
          ...violation.metadata,
          detectedAt: violation.detectedAt,
        },
      },
    });

    return record;
  }

  async findByTenant(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      severity?: ViolationSeverity[];
      violationType?: ViolationType[];
      entityType?: EntityType[];
      since?: Date;
      until?: Date;
    } = {}
  ): Promise<GhlViolationRecord[]> {
    const {
      limit = 100,
      offset = 0,
      severity,
      violationType,
      entityType,
      since,
      until,
    } = options;

    const where: any = { tenantId };

    if (severity?.length) {
      where.severity = { in: severity };
    }

    if (violationType?.length) {
      where.violationType = { in: violationType };
    }

    if (entityType?.length) {
      where.entityType = { in: entityType };
    }

    if (since || until) {
      where.createdAt = {};
      if (since) where.createdAt.gte = since;
      if (until) where.createdAt.lte = until;
    }

    return this.prisma.ghlViolation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findBySnapshot(
    tenantId: string,
    snapshotId: string
  ): Promise<GhlViolationRecord[]> {
    return this.prisma.ghlViolation.findMany({
      where: { tenantId, snapshotId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEntity(
    tenantId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<GhlViolationRecord[]> {
    return this.prisma.ghlViolation.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getViolationSummary(
    tenantId: string,
    since?: Date
  ): Promise<{
    totalViolations: number;
    violationsBySeverity: Record<ViolationSeverity, number>;
    violationsByType: Record<ViolationType, number>;
    violationsByEntityType: Record<EntityType, number>;
    mostRecentViolation?: Date;
  }> {
    const where: any = { tenantId };
    if (since) {
      where.createdAt = { gte: since };
    }

    const violations = await this.prisma.ghlViolation.findMany({
      where,
      select: {
        severity: true,
        violationType: true,
        entityType: true,
        createdAt: true,
      },
    });

    const summary = {
      totalViolations: violations.length,
      violationsBySeverity: {} as Record<ViolationSeverity, number>,
      violationsByType: {} as Record<ViolationType, number>,
      violationsByEntityType: {} as Record<EntityType, number>,
      mostRecentViolation:
        violations.length > 0
          ? new Date(Math.max(...violations.map(v => v.createdAt.getTime())))
          : undefined,
    };

    // Count by severity
    violations.forEach(v => {
      summary.violationsBySeverity[v.severity] =
        (summary.violationsBySeverity[v.severity] || 0) + 1;
    });

    // Count by type
    violations.forEach(v => {
      summary.violationsByType[v.violationType] =
        (summary.violationsByType[v.violationType] || 0) + 1;
    });

    // Count by entity type
    violations.forEach(v => {
      summary.violationsByEntityType[v.entityType] =
        (summary.violationsByEntityType[v.entityType] || 0) + 1;
    });

    return summary;
  }

  async hasBlockingViolations(tenantId: string): Promise<boolean> {
    const blockingViolations = await this.prisma.ghlViolation.count({
      where: {
        tenantId,
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    });

    return blockingViolations > 0;
  }
}
