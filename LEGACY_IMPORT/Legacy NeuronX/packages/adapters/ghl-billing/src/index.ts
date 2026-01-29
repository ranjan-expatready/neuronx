/**
 * GHL Billing Adapter - WI-041
 * WI-045: GHL Product → Plan Mapping Hardening
 *
 * Read-only adapter for syncing GHL billing state into NeuronX entitlements.
 * Plan mapping is now policy-driven with enterprise-grade safety.
 */

export * from './types';

// Policy types and components
export * from './policy/plan-mapping-policy.types';
export { PlanMappingPolicyLoader } from './policy/plan-mapping-policy.loader';
export { PlanMappingPolicyResolver } from './policy/plan-mapping-policy.resolver';

export { GhlBillingEventNormalizer } from './event-normalizer';
export { EntitlementSyncService } from './entitlement-sync.service';
export { GhlBillingWebhookController } from './webhook.controller';

// Module exports for NestJS
export const GHL_BILLING_PROVIDERS = [
  GhlBillingEventNormalizer,
  EntitlementSyncService,
];

export const GHL_BILLING_CONTROLLERS = [GhlBillingWebhookController];
