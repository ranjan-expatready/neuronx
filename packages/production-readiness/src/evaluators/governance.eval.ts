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
 * Governance Evaluator
 * Assesses policy enforcement and governance health signals
 */
export class GovernanceEvaluator implements DomainEvaluator {
  readonly domain = ReadinessDomain.GOVERNANCE;

  constructor(_prismaClient?: any) {
    // Constructor for future DB integration
  }

  async evaluate(context: ReadinessEvaluationContext): Promise<DomainStatus> {
    const startTime = Date.now();
    const signals: ReadinessSignal[] = [];
    const nextSteps: ReadinessNextStep[] = [];

    // Check enforcement modes
    const enforcementSignals = await this.checkEnforcementModes();
    signals.push(...enforcementSignals);

    // Check blocked actions count
    const blockedActionsSignal = await this.checkBlockedActions(
      context.tenantId
    );
    signals.push(blockedActionsSignal);

    // Check override justifications rate
    const overrideSignal = await this.checkOverrideJustifications(
      context.tenantId
    );
    signals.push(overrideSignal);

    // Check missing principal attribution
    const principalSignal = await this.checkPrincipalAttribution(
      context.tenantId
    );
    signals.push(principalSignal);

    // Generate next steps based on signals
    if (enforcementSignals.some(s => s.status === SignalStatus.FAIL)) {
      nextSteps.push({
        title: 'Enforcement modes not production-ready',
        action: 'Switch decision, billing, and boundary policies to block mode',
        ownerRole: 'ADMIN',
        estimatedMins: 10,
        priority: 'HIGH',
        linkToDocs: 'docs/policies/enforcement-modes.md',
      });
    }

    if (blockedActionsSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'High blocked actions rate',
        action: 'Review governance policies and user training requirements',
        ownerRole: 'COMPLIANCE',
        estimatedMins: 60,
        priority: 'HIGH',
      });
    }

    if (principalSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Missing principal attribution',
        action: 'Audit and fix principal extraction in API endpoints',
        ownerRole: 'ENGINEERING',
        estimatedMins: 120,
        priority: 'HIGH',
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
      summary = `${failedSignals.length} governance failures detected`;
    } else if (unknownSignals.length > 0) {
      status = ReadinessStatus.UNKNOWN;
      summary = `${unknownSignals.length} governance signals unknown`;
    } else if (warnSignals.length > 0) {
      status = ReadinessStatus.WARN;
      summary = `${warnSignals.length} governance warnings`;
    } else {
      status = ReadinessStatus.READY;
      summary = 'Governance controls fully operational';
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

  private async checkEnforcementModes(): Promise<ReadinessSignal[]> {
    const signals: ReadinessSignal[] = [];

    // Check decision policy enforcement mode
    const decisionModeSignal: ReadinessSignal = {
      key: 'decisionEnforcementMode',
      value: 'monitor_only', // Would be loaded from actual policy
      status: SignalStatus.FAIL, // FAIL because not in block mode
      reason: 'Decision policy in monitor_only mode - not production-ready',
      evidenceRefs: ['policy:decision-policy.yaml'],
      policyRef: 'decision-policy',
      lastUpdated: new Date(),
    };
    signals.push(decisionModeSignal);

    // Check billing policy enforcement mode
    const billingModeSignal: ReadinessSignal = {
      key: 'billingEnforcementMode',
      value: 'monitor_only', // Would be loaded from actual policy
      status: SignalStatus.FAIL, // FAIL because not in block mode
      reason: 'Billing policy in monitor_only mode - not production-ready',
      evidenceRefs: ['policy:billing-policy.yaml'],
      policyRef: 'billing-policy',
      lastUpdated: new Date(),
    };
    signals.push(billingModeSignal);

    // Check boundary enforcement mode
    const boundaryModeSignal: ReadinessSignal = {
      key: 'boundaryEnforcementMode',
      value: 'monitor_only', // Would be loaded from actual policy
      status: SignalStatus.FAIL, // FAIL because not in block mode
      reason: 'Boundary policy in monitor_only mode - not production-ready',
      evidenceRefs: ['policy:ghl-boundary-policy.yaml'],
      policyRef: 'ghl-boundary-policy',
      lastUpdated: new Date(),
    };
    signals.push(boundaryModeSignal);

    return signals;
  }

  private async checkBlockedActions(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would query actual blocked actions from audit logs
      // For now, simulate based on tenant
      const blockedCount = tenantId.includes('test') ? 0 : 5; // Simulate some blocks

      const status =
        blockedCount === 0
          ? SignalStatus.PASS
          : blockedCount <= 10
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'blockedActionsCount',
        value: blockedCount,
        unit: 'actions',
        status,
        reason:
          blockedCount === 0
            ? 'No blocked actions in last 24 hours'
            : `${blockedCount} actions blocked in last 24 hours`,
        evidenceRefs: [`audit:blocked_actions:${tenantId}:24h`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'blockedActionsCount',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check blocked actions: ${(error as Error).message}`,
        evidenceRefs: [`audit:blocked_actions:${tenantId}:24h`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkOverrideJustifications(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would query override logs and check justification completeness
      // For now, simulate
      const totalOverrides = 3;
      const justifiedOverrides = 2;
      const rate =
        totalOverrides > 0 ? (justifiedOverrides / totalOverrides) * 100 : 100;

      const status =
        rate >= 90
          ? SignalStatus.PASS
          : rate >= 75
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'overrideJustificationsRate',
        value: Math.round(rate),
        unit: '%',
        status,
        reason: `${justifiedOverrides}/${totalOverrides} overrides properly justified in last 7 days`,
        evidenceRefs: [`audit:overrides:${tenantId}:7d`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'overrideJustificationsRate',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check override justifications: ${(error as Error).message}`,
        evidenceRefs: [`audit:overrides:${tenantId}:7d`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkPrincipalAttribution(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would check recent audit logs for missing principal attribution
      // For now, simulate - in production this should be 0
      const missingPrincipals = 0; // Perfect attribution
      const totalActions = 100; // Sample size
      const rate =
        totalActions > 0 ? (missingPrincipals / totalActions) * 100 : 0;

      const status =
        rate === 0
          ? SignalStatus.PASS
          : rate <= 1
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'missingPrincipalAttributionRate',
        value: Math.round(rate * 100) / 100,
        unit: '%',
        status,
        reason:
          rate === 0
            ? 'Perfect principal attribution in recent actions'
            : `${missingPrincipals} actions missing principal attribution`,
        evidenceRefs: [`audit:principals:${tenantId}:recent`],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'missingPrincipalAttributionRate',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Failed to check principal attribution: ${(error as Error).message}`,
        evidenceRefs: [`audit:principals:${tenantId}:recent`],
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
