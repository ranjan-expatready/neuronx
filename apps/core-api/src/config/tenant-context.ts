/**
 * Tenant Context - REQ-013: Tenant Isolation
 *
 * Provides tenant scoping for configuration operations.
 * Enables multi-tenant configuration isolation while maintaining backward compatibility.
 */

export type Environment = 'prod' | 'staging' | 'dev';

/**
 * Tenant context for configuration operations
 * Provides isolation boundary for tenant-specific configurations
 */
export interface TenantContext {
  /** Unique tenant identifier (required) */
  tenantId: string;

  /** Deployment environment */
  environment: Environment;
}

/**
 * Creates a system tenant context for backward compatibility
 * Used when no explicit tenant context is provided
 */
export function createSystemTenantContext(): TenantContext {
  return {
    tenantId: 'system',
    environment: 'prod',
  };
}

/**
 * Validates tenant context structure
 */
export function validateTenantContext(context: TenantContext): boolean {
  return (
    typeof context.tenantId === 'string' &&
    context.tenantId.trim().length > 0 &&
    ['prod', 'staging', 'dev'].includes(context.environment)
  );
}
