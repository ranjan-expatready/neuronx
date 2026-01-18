/**
 * Org Authority Package - WI-035: Tenant & Organization Authority Model
 */

// Types and enums
export * from './types';

// Core services
export { CapabilityMap } from './capability-map';
export { AuthorityResolver } from './authority-resolver';
export { ApprovalChainResolver } from './approval-chain-resolver';
export { InMemoryOrgStore } from './in-memory-org-store';

// Errors
export {
  OrgAuthzError,
  OrgScopeError,
  InsufficientCapabilitiesError,
} from './types';
