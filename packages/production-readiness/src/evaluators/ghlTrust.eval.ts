import {
  DomainEvaluator,
  ReadinessDomain,
  ReadinessEvaluationContext,
  DomainStatus,
  ReadinessStatus,
  SignalStatus,
  ReadinessSignal,
  ReadinessNextStep,
} from '../readiness.types';

/**
 * GHL Trust Evaluator
 * Assesses GHL integration health, snapshot freshness, drift detection, and boundary compliance
 */
export class GhlTrustEvaluator implements DomainEvaluator {
  readonly domain = ReadinessDomain.GHL_TRUST;

  constructor(_prismaClient?: any) {
    // Constructor for future DB integration
  }

  async evaluate(context: ReadinessEvaluationContext): Promise<DomainStatus> {
    const startTime = Date.now();
    const signals: ReadinessSignal[] = [];
    const nextSteps: ReadinessNextStep[] = [];

    // Check snapshot freshness
    const snapshotSignal = await this.checkSnapshotFreshness(context.tenantId);
    signals.push(snapshotSignal);

    // Check drift severity
    const driftSignal = await this.checkDriftSeverity(context.tenantId);
    signals.push(driftSignal);

    // Check boundary violations
    const boundarySignal = await this.checkBoundaryViolations(context.tenantId);
    signals.push(boundarySignal);

    // Check mapping coverage
    const mappingSignal = await this.checkMappingCoverage(context.tenantId);
    signals.push(mappingSignal);

    // Generate next steps based on signals
    if (snapshotSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'GHL snapshots stale or missing',
        action:
          'Trigger manual snapshot ingestion or investigate sync failures',
        ownerRole: 'ENGINEERING',
        estimatedMins: 30,
        priority: 'HIGH',
        linkToDocs: 'docs/ghl-snapshots/troubleshooting.md',
      });
    }

    if (driftSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'High drift severity detected',
        action: 'Review and resolve GHL configuration drift',
        ownerRole: 'ADMIN',
        estimatedMins: 60,
        priority: 'HIGH',
        linkToDocs: 'docs/ghl-drift/resolution.md',
      });
    }

    if (boundarySignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Critical boundary violations',
        action: 'Immediate remediation of GHL boundary violations',
        ownerRole: 'COMPLIANCE',
        estimatedMins: 120,
        priority: 'HIGH',
        linkToDocs: 'docs/ghl-boundary-enforcer/remediation.md',
      });
    }

    if (mappingSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Poor GHL location mapping coverage',
        action: 'Complete GHL location to team mappings',
        ownerRole: 'ADMIN',
        estimatedMins: 45,
        priority: 'HIGH',
        linkToDocs: 'docs/org-integration-mapping/setup.md',
      });
    }

    // Calculate domain status
    const failedSignals = signals.filter(s => s.status === SignalStatus.FAIL);
    const unknownSignals = signals.filter(
      s => s.status === SignalStatus.UNKNOWN
    );
    const warnSignals = signals.filter(s => s.status === SignalStatus.WARN);

    let status: ReadinessStatus;
    let summary: string;

    if (failedSignals.length > 0) {
      status = ReadinessStatus.BLOCKED;
      summary = `${failedSignals.length} GHL trust issues detected`;
    } else if (unknownSignals.length > 0) {
      status = ReadinessStatus.UNKNOWN;
      summary = `${unknownSignals.length} GHL trust signals unknown`;
    } else if (warnSignals.length > 0) {
      status = ReadinessStatus.WARN;
      summary = `${warnSignals.length} GHL trust warnings`;
    } else {
      status = ReadinessStatus.READY;
      summary = 'GHL integration fully trusted and operational';
    }

    const domainScore = this.calculateDomainScore(signals);

    return {
      status,
      summary,
      signals: context.includeDetails ? signals : [],
      actionableNextSteps: nextSteps,
      lastEvaluated: new Date(),
      evaluationDurationMs: Date.now() - startTime,
      domainScore,
    };
  }

  private async checkSnapshotFreshness(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would check the latest snapshot timestamps for each type
      // For now, simulate based on tenant
      const snapshotTypes = [
        'locations',
        'pipelines',
        'workflows',
        'calendars',
        'ai_workers',
      ];
      const staleSnapshots = tenantId.includes('stale')
        ? snapshotTypes.slice(0, 2)
        : [];
      const freshSnapshots = snapshotTypes.length - staleSnapshots.length;

      const freshnessRate = (freshSnapshots / snapshotTypes.length) * 100;
      const status =
        freshnessRate >= 80
          ? SignalStatus.PASS
          : freshnessRate >= 60
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'snapshotFreshness',
        value: `${freshSnapshots}/${snapshotTypes.length}`,
        unit: 'types',
        status,
        reason:
          staleSnapshots.length === 0
            ? 'All GHL snapshot types fresh (< 24h old)'
            : `Stale snapshots: ${staleSnapshots.join(', ')}`,
        evidenceRefs: snapshotTypes.map(
          type => `snapshot:latest:${tenantId}:${type}`
        ),
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'snapshotFreshness',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check snapshot freshness: ${(error as Error).message}`,
        evidenceRefs: [`snapshot:latest:${tenantId}:*`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkDriftSeverity(tenantId: string): Promise<ReadinessSignal> {
    try {
      // This would query drift detection results for HIGH/CRITICAL severity
      // For now, simulate
      const highSeverityDrift = tenantId.includes('drift') ? 3 : 0;
      const criticalSeverityDrift = tenantId.includes('critical') ? 1 : 0;
      const totalDrift = highSeverityDrift + criticalSeverityDrift;

      const status =
        totalDrift === 0
          ? SignalStatus.PASS
          : totalDrift <= 2
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'driftSeverityCount',
        value: totalDrift,
        unit: 'incidents',
        status,
        reason:
          totalDrift === 0
            ? 'No high/critical drift detected in last 7 days'
            : `${totalDrift} high/critical drift incidents in last 7 days`,
        evidenceRefs: [`drift:severity:${tenantId}:7d`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'driftSeverityCount',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check drift severity: ${(error as Error).message}`,
        evidenceRefs: [`drift:severity:${tenantId}:7d`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkBoundaryViolations(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would query boundary violation counts by severity
      // For now, simulate - in block mode, HIGH/CRITICAL should be 0
      const highViolations = tenantId.includes('boundary') ? 2 : 0;
      const criticalViolations = tenantId.includes('critical') ? 1 : 0;
      const totalViolations = highViolations + criticalViolations;

      const status =
        totalViolations === 0
          ? SignalStatus.PASS
          : totalViolations <= 1
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'boundaryViolationsCount',
        value: totalViolations,
        unit: 'violations',
        status,
        reason:
          totalViolations === 0
            ? 'No high/critical boundary violations in last 7 days'
            : `${totalViolations} high/critical boundary violations in last 7 days`,
        evidenceRefs: [`boundary:violations:${tenantId}:7d`],
        policyRef: 'ghl-boundary-policy',
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'boundaryViolationsCount',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check boundary violations: ${(error as Error).message}`,
        evidenceRefs: [`boundary:violations:${tenantId}:7d`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkMappingCoverage(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would check the percentage of opportunities with team assignments
      // and count unmapped GHL locations
      const totalOpportunities = 100;
      const mappedOpportunities = tenantId.includes('unmapped') ? 70 : 95;
      const coverageRate = (mappedOpportunities / totalOpportunities) * 100;
      const unmappedLocations = tenantId.includes('unmapped') ? 5 : 0;

      const status =
        coverageRate >= 95 && unmappedLocations === 0
          ? SignalStatus.PASS
          : coverageRate >= 90 || unmappedLocations <= 2
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'mappingCoverage',
        value: Math.round(coverageRate),
        unit: '%',
        status,
        reason: `Opportunity mapping: ${mappedOpportunities}/${totalOpportunities} (${unmappedLocations} unmapped locations)`,
        evidenceRefs: [
          `org:mapping:opportunities:${tenantId}`,
          `org:mapping:locations:${tenantId}`,
        ],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'mappingCoverage',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check mapping coverage: ${(error as Error).message}`,
        evidenceRefs: [
          `org:mapping:opportunities:${tenantId}`,
          `org:mapping:locations:${tenantId}`,
        ],
        lastUpdated: new Date(),
      };
    }
  }

  private calculateDomainScore(signals: ReadinessSignal[]): number {
    if (signals.length === 0) return 100;

    const scoreMap = {
      [SignalStatus.PASS]: 100,
      [SignalStatus.WARN]: 75,
      [SignalStatus.FAIL]: 25,
      [SignalStatus.UNKNOWN]: 50,
    };

    const totalScore = signals.reduce(
      (sum, signal) => sum + scoreMap[signal.status],
      0
    );
    return Math.round(totalScore / signals.length);
  }
}
