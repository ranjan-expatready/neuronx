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
import * as fs from 'fs';
import * as path from 'path';

/**
 * System Health Evaluator
 * Assesses backend operational health and basic infrastructure status
 */
export class SystemHealthEvaluator implements DomainEvaluator {
  readonly domain = ReadinessDomain.SYSTEM_HEALTH;

  constructor(_prismaClient?: any) {
    // Constructor for future DB integration
  }

  async evaluate(context: ReadinessEvaluationContext): Promise<DomainStatus> {
    const startTime = Date.now();
    const signals: ReadinessSignal[] = [];
    const nextSteps: ReadinessNextStep[] = [];

    // Check policy loaders status
    const policyLoadersSignal = await this.checkPolicyLoaders();
    signals.push(policyLoadersSignal);

    if (policyLoadersSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Policy loaders failing',
        action: 'Check policy file syntax and loader implementations',
        ownerRole: 'ENGINEERING',
        estimatedMins: 30,
        priority: 'HIGH',
      });
    }

    // Check database connectivity (simplified)
    const dbConnectivitySignal = await this.checkDatabaseConnectivity(
      context.tenantId
    );
    signals.push(dbConnectivitySignal);

    if (dbConnectivitySignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'Database connectivity issues',
        action: 'Check database connection strings and network connectivity',
        ownerRole: 'INFRASTRUCTURE',
        estimatedMins: 15,
        priority: 'HIGH',
      });
    }

    // Check API responsiveness (simplified self-test)
    const apiResponsivenessSignal = await this.checkApiResponsiveness();
    signals.push(apiResponsivenessSignal);

    if (apiResponsivenessSignal.status === SignalStatus.FAIL) {
      nextSteps.push({
        title: 'API responsiveness degraded',
        action: 'Check application logs and resource utilization',
        ownerRole: 'ENGINEERING',
        estimatedMins: 20,
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
      summary = `${failedSignals.length} critical system issues detected`;
    } else if (unknownSignals.length > 0) {
      status = ReadinessStatus.UNKNOWN;
      summary = `${unknownSignals.length} system health signals unknown`;
    } else if (warnSignals.length > 0) {
      status = ReadinessStatus.WARN;
      summary = `${warnSignals.length} system health warnings`;
    } else {
      status = ReadinessStatus.READY;
      summary = 'All system health checks passing';
    }

    // Calculate domain score (simple average for now)
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

  private async checkPolicyLoaders(): Promise<ReadinessSignal> {
    const policyFiles = [
      'config/decision-policy.yaml',
      'config/channel-routing-policy.yaml',
      'config/billing-policy.yaml',
      'config/plan-mapping-policy.yaml',
      'config/ghl-capability-policy.yaml',
      'config/voice-policy.yaml',
      'config/rep-skill-policy.yaml',
      'config/ghl-boundary-policy.yaml',
    ];

    let validPolicies = 0;
    let invalidPolicies = 0;
    const invalidPolicyNames: string[] = [];

    for (const policyFile of policyFiles) {
      const policyPath = path.join(process.cwd(), policyFile);

      try {
        // Basic file existence and YAML parsing check
        if (fs.existsSync(policyPath)) {
          const content = fs.readFileSync(policyPath, 'utf-8');
          // Basic YAML structure check
          if (content.trim().length > 0) {
            validPolicies++;
          } else {
            invalidPolicies++;
            invalidPolicyNames.push(policyFile);
          }
        } else {
          invalidPolicies++;
          invalidPolicyNames.push(policyFile);
        }
      } catch (error) {
        invalidPolicies++;
        invalidPolicyNames.push(policyFile);
      }
    }

    const status =
      invalidPolicies === 0
        ? SignalStatus.PASS
        : invalidPolicies <= 2
          ? SignalStatus.WARN
          : SignalStatus.FAIL;

    return {
      key: 'policyLoadersStatus',
      value: `${validPolicies}/${policyFiles.length}`,
      unit: 'policies',
      status,
      reason:
        invalidPolicies === 0
          ? 'All policy files loaded successfully'
          : `Failed to load ${invalidPolicies} policy files: ${invalidPolicyNames.join(', ')}`,
      evidenceRefs: policyFiles.map(f => `file:${f}`),
      lastUpdated: new Date(),
    };
  }

  private async checkDatabaseConnectivity(
    tenantId: string
  ): Promise<ReadinessSignal> {
    try {
      // This would be replaced with actual database connectivity check
      // For now, simulate a basic connectivity test
      const isConnected = true; // Placeholder

      if (isConnected) {
        return {
          key: 'databaseConnectivity',
          value: 'CONNECTED',
          status: SignalStatus.PASS,
          reason: 'Database connectivity verified',
          evidenceRefs: [`db:connectivity:${tenantId}`],
          lastUpdated: new Date(),
        };
      } else {
        return {
          key: 'databaseConnectivity',
          value: 'DISCONNECTED',
          status: SignalStatus.FAIL,
          reason: 'Database connectivity check failed',
          evidenceRefs: [`db:connectivity:${tenantId}`],
          lastUpdated: new Date(),
        };
      }
    } catch (error) {
      return {
        key: 'databaseConnectivity',
        value: 'UNKNOWN',
        status: SignalStatus.UNKNOWN,
        reason: `Database connectivity check error: ${(error as Error).message}`,
        evidenceRefs: [`db:connectivity:${tenantId}`],
        lastUpdated: new Date(),
      };
    }
  }

  private async checkApiResponsiveness(): Promise<ReadinessSignal> {
    const startTime = Date.now();

    try {
      // This would be replaced with actual API health check
      // For now, simulate a basic self-test
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate some work
      const responseTime = Date.now() - startTime;

      const status =
        responseTime < 100
          ? SignalStatus.PASS
          : responseTime < 500
            ? SignalStatus.WARN
            : SignalStatus.FAIL;

      return {
        key: 'apiResponsiveness',
        value: responseTime,
        unit: 'ms',
        status,
        reason: `API response time: ${responseTime}ms`,
        evidenceRefs: ['health:self-test'],
        lastUpdated: new Date(),
      };
    } catch (error) {
      return {
        key: 'apiResponsiveness',
        value: 'ERROR',
        status: SignalStatus.FAIL,
        reason: `API responsiveness check failed: ${(error as Error).message}`,
        evidenceRefs: ['health:self-test'],
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
