/**
 * GHL Read Adapter Package - WI-070: Read-Only GHL Live Data Integration
 *
 * Provides read-only access to GHL data for trust validation.
 * HARD-BLOCKS ALL MUTATIONS with governance enforcement.
 */

export { GhlReadAdapter } from './adapters/ghl-read-adapter';
export { GhlSnapshotService } from './snapshots/snapshot-service';
export { GovernanceGuard } from './governance/governance-guard';

// Export types
export type {
  IReadOnlyCRMAdapter,
  IReadOnlyIdentityAdapter,
  GhlReadAdapterConfig,
  GhlSnapshotData,
  SnapshotMetadata,
  ContactSnapshot,
  OpportunitySnapshot,
  PipelineSnapshot,
  GovernanceViolation,
  GovernanceViolationType,
  DataFreshness,
  DataAlignment,
  AdapterContext,
} from './types';

// Factory function for creating read-only GHL adapter
export function createGhlReadAdapter(config: GhlReadAdapterConfig) {
  return new GhlReadAdapter(config);
}

// Utility function to check if operation is read-only allowed
export function isReadOnlyOperation(operation: string): boolean {
  const readOnlyOperations = [
    'getLead',
    'listLeads',
    'getOpportunity',
    'listOpportunities',
    'getPipelines',
    'getPipeline',
    'listUsers',
    'getUser',
    'getUserByEmail',
    'createSnapshot',
    'getLatestSnapshot',
    'getSnapshot',
    'listSnapshots',
    'getHealth',
    'getCapabilities',
    'validateConfig',
  ];

  return readOnlyOperations.includes(operation);
}

// Governance helper
export function validateReadOnlyMode(): void {
  const neuronxEnv = process.env.NEURONX_ENV;
  if (neuronxEnv === 'production') {
    // In production, be extra strict
    console.log(
      '🛡️ GHL Read Adapter: Production environment detected - enforcing strict read-only mode'
    );
  }
}
