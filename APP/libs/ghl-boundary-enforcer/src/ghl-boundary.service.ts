import { v4 as uuidv4 } from 'uuid';
import { BoundaryPolicyLoader } from './boundary-policy.loader';
import { GhlBoundaryAnalyzer } from './ghl-boundary-analyzer';
import { BoundaryPolicyResolver } from './boundary-policy.resolver';
import { PrismaGhlViolationStore } from './ghl-violation.store';
import type { GhlViolationStore } from './ghl-violation.store';
import type {
  BoundaryAnalysisResult,
  ViolationSeverity,
} from './ghl-violation.types';

/**
 * Main service for GHL Boundary Enforcement
 * Orchestrates policy loading, analysis, and violation storage
 */
export class GhlBoundaryService {
  private policyResolver: BoundaryPolicyResolver;
  private analyzer: GhlBoundaryAnalyzer;
  private violationStore: GhlViolationStore;

  constructor(
    prismaClient: any, // TODO: Import proper Prisma type
    policyPath?: string
  ) {
    // Load and validate policy
    const policy = BoundaryPolicyLoader.load(policyPath);

    // Initialize components
    this.policyResolver = new BoundaryPolicyResolver(policy);
    this.analyzer = new GhlBoundaryAnalyzer(policy, '1.0.0'); // TODO: Version from config
    this.violationStore = new PrismaGhlViolationStore(prismaClient);
  }

  /**
   * Analyze a GHL snapshot for boundary violations
   * Automatically stores violations if any are found
   */
  async analyzeSnapshot(
    tenantId: string,
    snapshotId: string,
    snapshotData: any,
    correlationId?: string
  ): Promise<BoundaryAnalysisResult> {
    const requestCorrelationId = correlationId || uuidv4();

    // Analyze snapshot for violations
    const analysisResult = this.analyzer.analyzeSnapshot(
      tenantId,
      snapshotId,
      snapshotData,
      requestCorrelationId
    );

    // Store violations if any were found
    if (analysisResult.violations.length > 0) {
      await this.violationStore.storeViolations(analysisResult);
    }

    return analysisResult;
  }

  /**
   * Check if a tenant should be blocked due to boundary violations
   * Only returns true if enforcement mode is 'block' and HIGH/CRITICAL violations exist
   */
  async shouldBlockTenant(tenantId: string): Promise<boolean> {
    // If not in block mode, never block
    if (!this.policyResolver.shouldBlockOperations()) {
      return false;
    }

    // Check for blocking violations
    return this.violationStore.hasBlockingViolations(tenantId);
  }

  /**
   * Get boundary enforcement status for a tenant
   */
  async getTenantBoundaryStatus(tenantId: string): Promise<{
    enforcementMode: 'monitor_only' | 'block';
    hasBlockingViolations: boolean;
    shouldBlockTenant: boolean;
    violationSummary: {
      totalViolations: number;
      violationsBySeverity: Record<ViolationSeverity, number>;
      mostRecentViolation?: Date;
    };
  }> {
    const enforcementMode = this.policyResolver.getEnforcementMode();
    const hasBlockingViolations =
      await this.violationStore.hasBlockingViolations(tenantId);
    const violationSummary =
      await this.violationStore.getViolationSummary(tenantId);

    return {
      enforcementMode,
      hasBlockingViolations,
      shouldBlockTenant: enforcementMode === 'block' && hasBlockingViolations,
      violationSummary,
    };
  }

  /**
   * Query violations for a tenant with filtering options
   */
  async getTenantViolations(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      severity?: ViolationSeverity[];
      since?: Date;
      until?: Date;
    }
  ) {
    return this.violationStore.findByTenant(tenantId, options);
  }

  /**
   * Get violations for a specific snapshot
   */
  async getSnapshotViolations(tenantId: string, snapshotId: string) {
    return this.violationStore.findBySnapshot(tenantId, snapshotId);
  }

  /**
   * Get violations for a specific entity
   */
  async getEntityViolations(
    tenantId: string,
    entityType: string,
    entityId: string
  ) {
    return this.violationStore.findByEntity(
      tenantId,
      entityType as any,
      entityId
    );
  }

  /**
   * Get policy resolver for direct policy access
   */
  getPolicyResolver(): BoundaryPolicyResolver {
    return this.policyResolver;
  }

  /**
   * Get analyzer for direct analysis (bypasses storage)
   */
  getAnalyzer(): GhlBoundaryAnalyzer {
    return this.analyzer;
  }

  /**
   * Get violation store for direct database access
   */
  getViolationStore(): GhlViolationStore {
    return this.violationStore;
  }

  /**
   * Validate policy configuration (for testing/admin)
   */
  validatePolicy(rawConfig: any): boolean {
    try {
      BoundaryPolicyLoader.validate(rawConfig);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current policy version
   */
  getPolicyVersion(): string {
    return '1.0.0'; // TODO: Read from policy file or config
  }

  /**
   * Force reload policy (for development/admin use)
   */
  reloadPolicy(policyPath?: string): void {
    const policy = BoundaryPolicyLoader.load(policyPath);
    this.policyResolver = new BoundaryPolicyResolver(policy);
    this.analyzer = new GhlBoundaryAnalyzer(policy, this.getPolicyVersion());
  }
}

/**
 * Factory function to create boundary service
 */
export function createGhlBoundaryService(
  prismaClient: any,
  policyPath?: string
): GhlBoundaryService {
  return new GhlBoundaryService(prismaClient, policyPath);
}
