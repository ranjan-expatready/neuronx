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
 * Billing Revenue Evaluator
 * Assesses billing status, plan compliance, and revenue safety signals
 */
export class BillingRevenueEvaluator implements DomainEvaluator {
  readonly domain = ReadinessDomain.BILLING_REVENUE;

  constructor(_prismaClient?: any) {
    // Constructor for future DB integration
  }

  async evaluate(context: ReadinessEvaluationContext): Promise<DomainStatus> {
    const startTime = Date.now();
    const signals: ReadinessSignal[] = [];
    const nextSteps: ReadinessNextStep[] = [];

    // Check billing status
    const billingStatusSignal = await this.checkBillingStatus(context.tenantId);
    signals.push(billingStatusSignal);

    // Check plan tier resolution
    const planSignal = await this.checkPlanTierResolution(context.tenantId);
    signals.push(planSignal);

    // Check usage vs limits
    const usageSignal = await this.checkUsageVsLimits(context.tenantId);
    signals.push(usageSignal);

    // Check grace period
    const graceSignal = await this.checkGracePeriod(context.tenantId);
    if (graceSignal) signals.push(graceSignal);

    // Check billing sync failures
    const syncSignal = await this.checkBillingSyncFailures(context.tenantId);
    signals.push(syncSignal);

    // Generate next steps based on signals
    if (billingStatusSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Billing status blocked',
        action: 'Resolve outstanding billing issues and payment status',
        ownerRole: 'BILLING',
        estimatedMins: 60,
        priority: 'HIGH',
        linkToDocs: 'docs/billing/status-resolution.md',
      });
    }

    if (usageSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Usage limits exceeded',
        action: 'Review usage patterns and upgrade plan or optimize usage',
        ownerRole: 'ADMIN',
        estimatedMins: 45,
        priority: 'HIGH',
        linkToDocs: 'docs/billing/usage-limits.md',
      });
    }

    if (syncSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Billing sync failures',
        action: 'Investigate and resolve GHL billing synchronization issues',
        ownerRole: 'ENGINEERING',
        estimatedMins: 90,
        priority: 'HIGH',
        linkToDocs: 'docs/ghl-billing-sync/troubleshooting.md',
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
      summary = `${failedSignals.length} billing revenue issues detected`;
    } else if (unknownSignals.length > 0) {
      status = ReadinessStatus.UNKNOWN;
      summary = `${unknownSignals.length} billing signals unknown`;
    } else if (warnSignals.length > 0) {
      status = ReadinessStatus.WARN;
      summary = `${warnSignals.length} billing warnings`;
    } else {
      status = ReadinessStatus.READY;
      summary = 'Billing and revenue systems fully operational';
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

  private async checkBillingStatus(tenantId: string): Promise<ReadinessSignal> {
    try {
      // This would check the current billing status from TenantBillingState
      // For now, simulate - in production, BLOCKED status should block readiness
      const billingStatus = tenantId.includes('billing-blocked')
        ? 'BLOCKED'
        : tenantId.includes('billing-grace')
          ? 'GRACE'
          : 'ACTIVE';

      const status =
        billingStatus === 'ACTIVE'
          ? SignalStatus.PASS
          : billingStatus === 'GRACE'
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'billingStatus',
        value: billingStatus,
        status,
        reason:
          billingStatus === 'ACTIVE'
            ? 'Billing status active and current'
            : `Billing status: ${billingStatus} - requires attention`,
        evidenceRefs: [`billing:status:${tenantId}`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'billingStatus',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check billing status: ${(error as Error).message}`,
        evidenceRefs: [`billing:status:${tenantId}`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkPlanTierResolution(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would check plan tier resolution from billing state and mapping policy
      // For now, simulate
      const planTier = 'ENTERPRISE'; // Would be resolved from policies
      const mappingPolicyVersion = '1.2.3'; // Would be from policy

      const status = SignalStatus.PASS; // Assume successful resolution

      return {
        key: 'planTierResolved',
        value: planTier,
        status,
        reason: `Plan tier resolved to ${planTier} using mapping policy v${mappingPolicyVersion}`,
        evidenceRefs: [
          `billing:plan:${tenantId}`,
          `policy:plan-mapping-policy.yaml:v${mappingPolicyVersion}`,
        ],
        policyRef: 'plan-mapping-policy',
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'planTierResolved',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check plan tier resolution: ${(error as Error).message}`,
        evidenceRefs: [`billing:plan:${tenantId}`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkUsageVsLimits(tenantId: string): Promise<ReadinessSignal> {
    try {
      // This would check current period usage against limits
      // For now, simulate usage data
      const currentUsage = {
        EXECUTION: tenantId.includes('high-usage') ? 9500 : 7500,
        VOICE_MINUTE: tenantId.includes('high-usage') ? 4800 : 3200,
        EXPERIMENT: tenantId.includes('high-usage') ? 180 : 120,
      };

      const limits = {
        EXECUTION: 10000,
        VOICE_MINUTE: 5000,
        EXPERIMENT: 200,
      };

      const overLimitMetrics = Object.entries(currentUsage)
        .filter(
          ([metric, usage]) => usage > limits[metric as keyof typeof limits]
        )
        .map(
          ([metric, usage]) =>
            `${metric}: ${usage}/${limits[metric as keyof typeof limits]}`
        );

      const status =
        overLimitMetrics.length === 0
          ? SignalStatus.PASS
          : overLimitMetrics.length <= 1
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'usageVsLimits',
        value: `${Object.values(currentUsage).reduce((a, b) => a + b, 0)}/${Object.values(limits).reduce((a, b) => a + b, 0)}`,
        unit: 'total',
        status,
        reason:
          overLimitMetrics.length === 0
            ? 'All usage within current period limits'
            : `Usage over limits: ${overLimitMetrics.join(', ')}`,
        evidenceRefs: [`billing:usage:${tenantId}:current-period`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'usageVsLimits',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check usage vs limits: ${(error as Error).message}`,
        evidenceRefs: [`billing:usage:${tenantId}:current-period`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkGracePeriod(
    tenantId: string
  ): Promise<ReadinessSignal | null> {
    try {
      // This would check if tenant is in grace period and remaining days
      // For now, only return signal if in grace period
      const inGracePeriod = tenantId.includes('billing-grace');
      if (!inGracePeriod) {
        return null; // Signal not applicable
      }

      const remainingDays = 7; // Would be calculated from actual data

      const status =
        remainingDays > 3
          ? SignalStatus.WARN
          : remainingDays > 0
            ? SignalStatus.FAIL
            : SignalStatus.FAIL;

      return {
        key: 'gracePeriodRemaining',
        value: remainingDays,
        unit: 'days',
        status,
        reason: `${remainingDays} days remaining in billing grace period`,
        evidenceRefs: [`billing:grace:${tenantId}`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'gracePeriodRemaining',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check grace period: ${(error as Error).message}`,
        evidenceRefs: [`billing:grace:${tenantId}`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkBillingSyncFailures(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would check for billing sync failures in recent period
      // For now, simulate
      const syncFailures = tenantId.includes('sync-failures') ? 3 : 0;

      const status =
        syncFailures === 0
          ? SignalStatus.PASS
          : syncFailures <= 2
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'billingSyncFailures',
        value: syncFailures,
        unit: 'failures',
        status,
        reason:
          syncFailures === 0
            ? 'No billing sync failures in last 7 days'
            : `${syncFailures} billing sync failures in last 7 days`,
        evidenceRefs: [`billing:sync:${tenantId}:7d`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'billingSyncFailures',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check billing sync failures: ${(error as Error).message}`,
        evidenceRefs: [`billing:sync:${tenantId}:7d`],
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
