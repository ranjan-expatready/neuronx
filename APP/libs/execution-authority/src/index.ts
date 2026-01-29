/**
 * Execution Authority Package - WI-034: Multi-Channel Execution Authority
 * WI-043: Channel Routing Policy Configuration
 */

// Types
export * from './types';

// Policy types and components
export * from './policy/channel-routing-policy.types';
export { ChannelRoutingPolicyLoader } from './policy/channel-routing-policy.loader';
export { ChannelRoutingPolicyResolver } from './policy/channel-routing-policy.resolver';

// Core services
export { NeuronXExecutionAuthority } from './execution-authority';
export { DeterministicChannelRouter } from './channel-router';
export { ExecutionTokenService } from './execution-token.service';
export { IdempotencyHandler } from './idempotency';

// Builders and helpers
export { ExecutionContextBuilder } from './execution-context';

// Interfaces
export type { PolicyGuard } from './policy-guard';
// export type { ChannelRouter } from './channel-router'; // Removed as it is in types
export type { ExecutionAuthority } from './types';
export type { TokenRepository } from './execution-token.service';
export type { IdempotencyRepository } from './idempotency';
