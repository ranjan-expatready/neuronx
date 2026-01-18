// GHL Adapter Package Exports
// Only canonical interfaces and factory are exported - NO GHL types

export { GhlAdapter } from './ghl.adapter';

// Factory function for creating GHL adapters
export function createGhlAdapter(config: {
  tenantId: string;
  environment: 'dev' | 'stage' | 'prod';
  baseUrl?: string;
}) {
  return new GhlAdapter(config);
}
