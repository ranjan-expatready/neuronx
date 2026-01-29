/**
 * Billing & Entitlements Authority - WI-040
 * WI-044: Billing Plan & Limit Configuration
 *
 * Centralized billing and entitlement enforcement for NeuronX.
 * All limits and enforcement behavior now driven by policy configuration.
 */

export type {
  BillingDecision,
  EntitlementCheckRequest,
  PlanLimits,
} from './types';

export {
  UsageType,
  EnforcementMode,
} from './types';

// Policy types and components
export * from './policy/billing-policy.types';
export { BillingPolicyLoader } from './policy/billing-policy.loader';
export { BillingPolicyResolver } from './policy/billing-policy.resolver';

export { EntitlementEvaluator } from './entitlement-evaluator';
export { UsageAggregator } from './usage-aggregator';
export { BillingGuard } from './billing-guard';
export { BillingSyncService } from './billing-sync.service';

// Factory function for creating billing guard with policy resolver
import { BillingGuard } from './billing-guard';
import { EntitlementEvaluator } from './entitlement-evaluator';
import { UsageAggregator } from './usage-aggregator';
import { BillingPolicyResolver } from './policy/billing-policy.resolver';
import { PrismaClient } from '@prisma/client';
import { BillingSyncService } from './billing-sync.service';

export function createBillingGuard(
  prisma: PrismaClient,
  policyResolver: BillingPolicyResolver
): BillingGuard {
  const evaluator = new EntitlementEvaluator(prisma, policyResolver);
  const aggregator = new UsageAggregator(prisma);
  return new BillingGuard(evaluator, aggregator, policyResolver);
}

// Factory function for creating billing sync service
export function createBillingSyncServiceFactory(
  prisma: PrismaClient
): BillingSyncService {
  return new BillingSyncService(prisma);
}
